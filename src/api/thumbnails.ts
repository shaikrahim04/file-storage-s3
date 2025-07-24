import { getBearerToken, validateJWT } from "../auth";
import { getAssetDiskPath, getAssetURL, mediaTypeToExt } from "./assets";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import { randomBytes } from "crypto";

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
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
  const file = formData.get("thumbnail");
  if (!(file instanceof File)) {
    throw new BadRequestError("Thumbnail file missing");
  }

  const MAX_UPLOAD_SIZE = 10 << 20;

  if (file.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError(
      `Thumbnail file exceeds the maximum allowed size of 10MB`,
    );
  }

  const mediaType = file.type;
  if (!mediaType) {
    throw new BadRequestError("Missing Content-Type for thumbnail");
  }

  if(mediaType !== "image/jpeg" && mediaType !== "image/png") {
    throw new BadRequestError("Invalid Content-Type for thumbnail");
  }
   
  const ext = mediaTypeToExt(mediaType);

  const randomFileName = randomBytes(32).toString('base64');
  // console.log(randomFileName);
  const filename = `${randomFileName}${ext}`;

  const assetDiskPath = getAssetDiskPath(cfg, filename);
  await Bun.write(assetDiskPath, file);

  const urlPath = getAssetURL(cfg, filename);
  video.thumbnailURL = urlPath;
  updateVideo(cfg.db, video);

  return respondWithJSON(200, null);
}
