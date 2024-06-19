import fs from 'fs';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import mime from 'mime-types';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';
import Queue from 'bull';

const mkdirAsync = promisify(fs.mkdir);
const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const fileQueue = new Queue('fileQueue');

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, type, parentId = '0', isPublic = false, data } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    if (parentId !== '0') {
      const parentFile = await dbClient.db.collection('files').findOne({ _id: new dbClient.ObjectId(parentId) });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const fileDocument = {
      userId: new dbClient.ObjectId(userId),
      name,
      type,
      isPublic,
      parentId: parentId === '0' ? 0 : new dbClient.ObjectId(parentId),
    };

    if (type === 'folder') {
      const result = await dbClient.db.collection('files').insertOne(fileDocument);
      return res.status(201).json({
        id: result.insertedId,
        ...fileDocument,
      });
    } else {
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      const filePath = path.join(folderPath, uuidv4());

      try {
        await mkdirAsync(folderPath, { recursive: true });
        const fileData = Buffer.from(data, 'base64');
        await writeFileAsync(filePath, fileData);
      } catch (error) {
        return res.status(500).json({ error: 'Error writing file' });
      }

      fileDocument.localPath = filePath;

      const result = await dbClient.db.collection('files').insertOne(fileDocument);

      // Add job to queue for image processing if type is image
      if (type === 'image') {
        fileQueue.add({ userId, fileId: result.insertedId });
      }

      return res.status(201).json({
        id: result.insertedId,
        ...fileDocument,
      });
    }
  }

  static async getShow(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    const fileDocument = await dbClient.db.collection('files').findOne({ _id: new dbClient.ObjectId(fileId), userId: new dbClient.ObjectId(userId) });
    if (!fileDocument) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json({
      id: fileDocument._id,
      userId: fileDocument.userId,
      name: fileDocument.name,
      type: fileDocument.type,
      isPublic: fileDocument.isPublic,
      parentId: fileDocument.parentId,
      localPath: fileDocument.localPath,
    });
  }

  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const parentId = req.query.parentId || '0';
    const page = parseInt(req.query.page, 10) || 0;
    const pageSize = 20;
    const skip = page * pageSize;

    const query = { userId: new dbClient.ObjectId(userId) };
    if (parentId !== '0') {
      query.parentId = new dbClient.ObjectId(parentId);
    } else {
      query.parentId = 0;
    }

    const files = await dbClient.db.collection('files')
      .find(query)
      .skip(skip)
      .limit(pageSize)
      .toArray();

    const result = files.map(file => ({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
      localPath: file.localPath,
    }));

    return res.status(200).json(result);
  }

  static async putPublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    const fileDocument = await dbClient.db.collection('files').findOne({ _id: new dbClient.ObjectId(fileId), userId: new dbClient.ObjectId(userId) });
    if (!fileDocument) {
      return res.status(404).json({ error: 'Not found' });
    }

    await dbClient.db.collection('files').updateOne(
      { _id: new dbClient.ObjectId(fileId) },
      { $set: { isPublic: true } }
    );

    fileDocument.isPublic = true;
    return res.status(200).json({
      id: fileDocument._id,
      userId: fileDocument.userId,
      name: fileDocument.name,
      type: fileDocument.type,
      isPublic: fileDocument.isPublic,
      parentId: fileDocument.parentId,
      localPath: fileDocument.localPath,
    });
  }

  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    const fileDocument = await dbClient.db.collection('files').findOne({ _id: new dbClient.ObjectId(fileId), userId: new dbClient.ObjectId(userId) });
    if (!fileDocument) {
      return res.status(404).json({ error: 'Not found' });
    }

    await dbClient.db.collection('files').updateOne(
      { _id: new dbClient.ObjectId(fileId) },
      { $set: { isPublic: false } }
    );

    fileDocument.isPublic = false;
    return res.status(200).json({
      id: fileDocument._id,
      userId: fileDocument.userId,
      name: fileDocument.name,
      type: fileDocument.type,
      isPublic: fileDocument.isPublic,
      parentId: fileDocument.parentId,
      localPath: fileDocument.localPath,
    });
  }

  static async getFile(req, res) {
    const fileId = req.params.id;
    const token = req.headers['x-token'];
    const size = req.query.size;

    const fileDocument = await dbClient.db.collection('files').findOne({ _id: new dbClient.ObjectId(fileId) });
    if (!fileDocument) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (fileDocument.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    if (!fileDocument.isPublic) {
      if (!token) {
        return res.status(404).json({ error: 'Not found' });
      }

      const userId = await redisClient.get(`auth_${token}`);
      if (!userId || userId !== fileDocument.userId.toString()) {
        return res.status(404).json({ error: 'Not found' });
      }
    }

    let filePath = fileDocument.localPath;
    if (size) {
      const validSizes = ['500', '250', '100'];
      if (!validSizes.includes(size)) {
        return res.status(400).json({ error: 'Invalid size' });
      }
      filePath = `${fileDocument.localPath}_${size}`;
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    try {
      const fileContent = await readFileAsync(filePath);
      const mimeType = mime.lookup(fileDocument.name) || 'application/octet-stream';

      res.setHeader('Content-Type', mimeType);
      return res.status(200).send(fileContent);
    } catch (error) {
      return res.status(500).json({ error: 'Error retrieving file content' });
    }
  }
}

export default FilesController;
