const express = require('express');
const mysql = require('promise-mysql');
const cors = require('cors');

// Express middleware
const bodyParser = require('body-parser');
const morgan = require('morgan');
const checkLoginToken = require('./lib/check-login-token.js');

// Data loader
const FlorifyDataLoader = require('./lib/florify.js');

// Controllers
const authController = require('./controllers/auth.js');
const plantsController = require('./controllers/plants.js');


// Database / data loader initialization
const connection = mysql.createPool({
  user: 'root',
  database: 'florify',
  password: '1234'
});
const dataLoader = new FlorifyDataLoader(connection);


// Express initialization
const app = express();
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(checkLoginToken(dataLoader));

app.use('/auth', authController(dataLoader));
app.use('/plants', plantsController(dataLoader));


app.use(cors({
  allowedOrigins: ['localhost']
}));


// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  if (process.env.C9_HOSTNAME) {
    console.log(`Web server is listening on https://${process.env.C9_HOSTNAME}`);
  } else {
    console.log(`Web server is listening on http://localhost:${port}`);
  }
});
