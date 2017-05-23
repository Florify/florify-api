const superagent = require('superagent');
const express = require('express');
const mysql = require('promise-mysql');
const cors = require('cors');
const API_HOST = process.env.API_HOST;

// Express middleware
const bodyParser = require('body-parser');
const morgan = require('morgan');
const checkLoginToken = require('./lib/check-login-token.js');

// Data loader
const FlorifyDataLoader = require('./lib/florify.js');
const cronJob = require('cron').CronJob;

//ping reminders at 6pm every day
const textJob = new cronJob( '0 18 * * *', function(){
  return superagent
  .get(`${API_HOST}/reminders`)
  .end()
},  null, true);

// Controllers
const authController = require('./controllers/auth.js');
const plantsController = require('./controllers/plants.js');
const reminderController = require('./controllers/reminders.js');

// Database / data loader initialization

const connection = mysql.createPool(process.env.DATABASE_URL);
const dataLoader = new FlorifyDataLoader(connection);
const app = express();


app.use(cors({
  allowedOrigins: ['*']
}));


// Express initialization

app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(checkLoginToken(dataLoader));

app.use('/auth', authController(dataLoader));
app.use('/plants', plantsController(dataLoader));
app.use('/reminders', reminderController(dataLoader));


// Start the server
const port = process.env.PORT || 3001;
app.listen(port, () => {
  if (process.env.C9_HOSTNAME) {
    console.log(`Web server is listening on https://${process.env.C9_HOSTNAME}`);
  } else {
    console.log(`Web server is listening on http://localhost:${port}`);
  }
});
