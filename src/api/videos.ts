import { respondWithJSON } from "./json";

import { type ApiConfig } from "../config";
import type { BunRequest } from "bun";

import { BadRequestError, UserForbiddenError, NotFoundError } from "./errors";
import { getBearerToken, validateJWT } from "../auth";
import { getVideo, updateVideo } from "../db/videos";
import { getAssetDiskPath, mediaTypeToExt } from "./assets";
import { s3, S3Client } from "bun";
import { randomBytes } from "crypto";
import { type Video } from "../db/videos";

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {

  const MAX_UPLOAD_SIZE = 1 << 30;
  
  const { videoId } = req.params as { videoId?: string };

  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  const video = getVideo(cfg.db, videoId);

  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  if (video.userID !== userID) {
    throw new UserForbiddenError("Not authorized to update this video");
  }




  const formData = await req.formData();
  const file = formData.get("video");

  if ( !(file instanceof Blob ) ){
    throw new  BadRequestError("Video File is missing");
  }

  if ( file.size > MAX_UPLOAD_SIZE ) {
    throw new BadRequestError("Vide File exceeds max allowed size of 1GB");
  }

  const mediaType = file.type;

  if (!mediaType) {
    throw new BadRequestError("Missing media type for video");
  }

  if ( mediaType != "video/mp4" ) {
    throw new BadRequestError("Invalid media type for video");
  }

  const ext = mediaTypeToExt(mediaType);
  const randomFileName = randomBytes(32).toString('hex');
  
  const fileName = `${randomFileName}.${ext}`;

  const assetDiskPath = getAssetDiskPath(cfg, fileName);

  await Bun.write(assetDiskPath, file);

  const assetDiskPathProcessed = await processVideoForFastStart(assetDiskPath);
  await Bun.file(assetDiskPath).delete()

  const aspectSize = await getVideoAspectRatio(assetDiskPathProcessed);

  const s3Key = `${aspectSize}/${fileName}`;
  const s3File = cfg.s3Client.file(s3Key, { type: mediaType });

  await s3File.write(Bun.file(assetDiskPathProcessed));

  await Bun.file(assetDiskPathProcessed).delete();

  video.videoURL = s3Key;
  const signedURL = dbVideoToSignedVideo(cfg, video);

  updateVideo(cfg.db, video);

  return respondWithJSON(200, signedURL);
}

export function dbVideoToSignedVideo(cfg: ApiConfig, video: Video){
  const newVideo: Video = { ...video }; 

  if (video.videoURL) {
    newVideo.videoURL = generatePresignedURL(cfg, video.videoURL, 1200);
  } 
  else {
    newVideo.videoURL = "";
  }

  return newVideo;
}

 function generatePresignedURL(cfg: ApiConfig, key: string, expireTime: number) {
  const presignURL =  S3Client.presign(key, {
    expiresIn: expireTime
  });

  return presignURL;
}


async function getVideoAspectRatio(filePath: string) {
  const proc = Bun.spawn({
    cmd: [
      "ffprobe",
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "json",
      filePath
    ],
    stdout: "pipe",
    stderr: "pipe"
  });

  const stdout = await Bun.readableStreamToText(proc.stdout);
  const stderr = proc.stderr ? await Bun.readableStreamToText(proc.stderr) : "";

  const  exitCode  = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`ffprobe error (exit code ${exitCode}): ${stderr}`);
  }

  try {
    const data = JSON.parse(stdout);
    const stream = data.streams && data.streams[0];

    if (stream && typeof stream.width === 'number' && typeof stream.height === 'number') {
      const width = stream.width;
      const height = stream.height;

      // Only needed if sending the reduced ratios

      // const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);

      // const divisor = gcd(width, height);
      // const w = Math.round(width / divisor);
      // const h = Math.round(height / divisor);

      const tolerance = 0.01;

      const actualRatio = width / height;

      if (Math.abs(actualRatio - (16 / 9)) < tolerance) {
        return "landscape";
      }
      else if (Math.abs(actualRatio - (9 / 16)) < tolerance) {
        return "portrait";
      }
      else {
        return `other`;
      }
    }
    throw new Error("Width or height not found or invalid in ffprobe output.");
  } catch (e: any) {
    throw new Error(`Failed to parse ffprobe output: ${e.message || e}`);
  }
}
async function processVideoForFastStart(inputFilePath: string) {


  const outputFilePath = inputFilePath + ".processed";

  const proc = Bun.spawn({
    cmd: [
      "ffmpeg",
      "-i",
      inputFilePath,
      "-movflags",
      "faststart",
      "-map_metadata",
      "0",
      "-codec",
      "copy",
      "-f",
      "mp4",
      outputFilePath
    ],
    stdout: "pipe",
    stderr: "pipe"
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = proc.stderr ? await Bun.readableStreamToText(proc.stderr) : "";
    throw new Error(`ffmpeg error (exit code ${exitCode}): ${stderr}`);
  }

  return outputFilePath;
}