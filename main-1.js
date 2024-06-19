import dbClient from './utils/db';

const waitConnection = () => {
  return new Promise((resolve, reject) => {
    let i = 0;
    const repeatFct = async () => {
      await setTimeout(() => {
        i += 1;
        if (i >= 10) {
          reject(new Error('Failed to connect to MongoDB'));
        }
        else if (!dbClient.isAlive()) {
          repeatFct();
        }
        else {
          resolve();
        }
      }, 1000);
    };
    repeatFct();
  });
};

(async () => {
  console.log(dbClient.isAlive()); // false initially
  await waitConnection();
  console.log(dbClient.isAlive()); // true after connection
  console.log(await dbClient.nbUsers()); // number of users
  console.log(await dbClient.nbFiles()); // number of files
})();
