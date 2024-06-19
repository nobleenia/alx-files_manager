import express from 'express';
import routes from './routes/index';

const app = express();
const port = process.env.PORT || 5000;

// Middleware to parse JSON
app.use(express.json());

// Load routes
app.use(routes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
