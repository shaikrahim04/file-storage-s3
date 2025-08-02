
# Tubely: File Storage & S3 CDN Application

Tubely is a fully functional web application for uploading, storing, and serving videos and images. It uses AWS S3 for video storage and AWS CloudFront CDN distribution for secure and efficient video delivery. Images are stored locally, and their file paths and metadata are managed in a SQLite database. The app demonstrates modern file server techniques, secure uploads, video processing, and CDN-based access control for media files.

## What does Tubely do?

- Allows users to upload videos and images via a web interface
- Processes videos for fast streaming (using ffmpeg)
- Stores video files in AWS S3 buckets
- Delivers videos securely and efficiently via AWS CloudFront CDN distribution
- Stores images locally and tracks their location and metadata in SQLite
- Handles authentication and user management
- Provides endpoints for uploading, retrieving, and listing media
- Uses SQLite for metadata and user data

## Dependencies

### Install dependencies

- [Typescript](https://www.typescriptlang.org/)
- [Bun](https://bun.sh/)
- [FFMPEG](https://ffmpeg.org/download.html) (`ffmpeg` and `ffprobe` required in your `PATH`)
- [SQLite 3](https://www.sqlite.org/download.html) (for inspecting the database)
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)

#### Example installation (Linux)
```bash
sudo apt update
sudo apt install ffmpeg sqlite3
```

#### Example installation (Mac)
```bash
brew update
brew install ffmpeg sqlite3
```

## Usage

1. Download sample images and videos:
   ```bash
   ./samplesdownload.sh
   # samples/ dir will be created with sample images and videos
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your AWS and app settings
   ```

3. Run the server:
   ```bash
   bun run src/index.ts
   ```

   - The database file `tubely.db` will be created in the root directory.
   - The `assets` directory will be created for local image storage.

---

## Credits

This project was developed based on the course **Learn File Servers and CDNs with S3 and CloudFront** from **boot.dev**.

  - [Course link](https://www.boot.dev/courses/learn-file-servers-s3-cloudfront-typescript) on [boot.dev](https://www.boot.dev)
