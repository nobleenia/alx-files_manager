import { MongoClient, ObjectId } from 'mongodb';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';

    const url = `mongodb://${host}:${port}`;
    this.client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });
    this.isConnected = false;

    this.client.connect()
      .then((client) => {
        this.db = client.db(database);
        this.isConnected = true;
        console.log('MongoDB client connected to the server');
      })
      .catch((err) => {
        this.isConnected = false;
        console.error(`MongoDB client not connected to the server: ${err}`);
      });
  }

  async isAlive() {
    return this.isConnected;
  }

  async nbUsers() {
    try {
      if (!this.isConnected) throw new Error('MongoDB client not connected');
      return await this.db.collection('users').countDocuments();
    } catch (err) {
      console.error(`Error counting users: ${err}`);
      return 0;
    }
  }

  async nbFiles() {
    try {
      if (!this.isConnected) throw new Error('MongoDB client not connected');
      return await this.db.collection('files').countDocuments();
    } catch (err) {
      console.error(`Error counting files: ${err}`);
      return 0;
    }
  }

  get ObjectId() {
    return ObjectId;
  }
}

const dbClient = new DBClient();
export default dbClient;
