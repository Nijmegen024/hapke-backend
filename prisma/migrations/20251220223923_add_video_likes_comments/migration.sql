-- CreateTable
CREATE TABLE "VideoLike" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoComment" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoLike_videoId_idx" ON "VideoLike"("videoId");

-- CreateIndex
CREATE INDEX "VideoLike_userId_idx" ON "VideoLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoLike_videoId_userId_key" ON "VideoLike"("videoId", "userId");

-- CreateIndex
CREATE INDEX "VideoComment_videoId_idx" ON "VideoComment"("videoId");

-- CreateIndex
CREATE INDEX "VideoComment_userId_idx" ON "VideoComment"("userId");

-- AddForeignKey
ALTER TABLE "VideoLike" ADD CONSTRAINT "VideoLike_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoLike" ADD CONSTRAINT "VideoLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoComment" ADD CONSTRAINT "VideoComment_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoComment" ADD CONSTRAINT "VideoComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
