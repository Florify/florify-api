const accountSid = 'ACfded503b1680e1405943269ff2e27eb9'; // Your Account SID from www.twilio.com/console
const authToken = '981cd647d76f63b8f5c0c7fe3409f92c';   // Your Auth Token from www.twilio.com/console


const twilio = require('twilio');
const client = new twilio(accountSid, authToken);


const express = require('express');


module.exports = (dataLoader) => {

  const reminderController = express.Router();



  reminderController.get('/', (req, res) => {
    return dataLoader.getUser()
    .then(users => {
      return Promise.all(
        users.map(user => {
          return dataLoader.getPlants(user.id)
        })
      )
    })
    .then(result => {
      result.forEach(plantArr => {
        plantArr.forEach(plant =>{
          if (plant.latestHum && plant.latestHum.reading < plant.minhum){
            dataLoader.getUser(plant.userId)
            .then(user => {
              client.messages.create({
                  body: `Your plant ${plant.nickname} needs water! Its soil humidity is a low low ${Math.round(plant.latestHum.reading)}%.`,
                  to: `+1${user[0].phone}`,  // Text this number
                  from: '+15145007822 ' // From a valid Twilio number
              })
              .then((message) => console.log(message.sid));
            })
          }
        })
      })
    })
    .then(data => res.json(data)).catch(err => res.status(400).json(err));
  });

  //cron logic







 return reminderController;
}
