const express = require('express');
const cors = require('cors');
const apiRouter = require('./routes');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Welcome to EdraLabs Machine Coding Assignment API');
});

app.use('/api/', apiRouter);

app.use((req, res) => {
  res.status(404).send({ message: 'Route not found' });
});

app.use(errorHandler);


module.exports = app;