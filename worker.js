import Queue from 'bull';
import imageThumbnail from 'image-thumbnail';
import fs from 'fs';
import path from 'path';
import dbClient from './utils/db';

const fileQueue = new Queue('fileQueue');

fileQueue.process(async (job, done) => {
  const { userId, fileId } = job.data;

  if (!fileId) {
    return done(new Error('Missing fileId'));
  }

  if (!userId) {
    return done(new Error('Missing userId'));
  }

  const fileDocument = await dbClient.db.collection('files').findOne({ _id: new dbClient.ObjectId(fileId), userId: new dbClient.ObjectId(userId) });
  if (!fileDocument) {
    return done(new Error('File not found'));
  }

  const sizes = [500, 250, 100];
  try {
    for (const size of sizes) {
      const thumbnail = await imageThumbnail(fileDocument.localPath, { width: size });
      const thumbnailPath = `${fileDocument.localPath}_${size}`;
      fs.writeFileSync(thumbnailPath, thumbnail);
    }
    done();
  } catch (error) {
    done(new Error('Error generating thumbnails'));
  }
});
