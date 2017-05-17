const express = require('express');

const onlyLoggedIn = require('../lib/only-logged-in');

module.exports = (dataLoader) => {
  const plantsController = express.Router();

  // Retrieve a list of boards
  plantsController.get('/', onlyLoggedIn, (req, res) => {
    // console.log(req.body.token, "hello");
    // console.log(req.sessionToken, "this is frustrating");
    return dataLoader.getUserFromSession(req.sessionToken)
    .then((user) => {
      // console.log(user, "blablabla");
      return dataLoader.getPlants(user.users_id)
    })
    .then(data => res.json(data))
    .catch(err => res.status(400).json(err));
  });

  // Retrieve a single board
  plantsController.get('/:id', (req, res) => {
    // dataLoader.getSinglePlant(req.params.id)
    // .then(result=> {console.log(result, "sexy")})
    // console.log(res, 'who are you');
    return dataLoader.getSinglePlant(req.params.id)
    .then(data => res.json(data))
    .catch(err => res.status(400).json(err));
  });
  // post data
plantsController.post('/:id/:type/:reading', (req, res) => {
    return dataLoader.createData(req.params.id, req.params.type, req.params.reading)
    .then(data => res.json(data))
    .catch(err => res.status(400).json(err));

})
  // Create a new board
  plantsController.post('/', onlyLoggedIn, (req, res) => {
    // console.log('hallo', req.body)
    return dataLoader.getUserFromSession(req.sessionToken)
    .then((user) => {
      return dataLoader.createPlant({
        userId: user.users_id,
        nickname: req.body.nickname,
        name: req.body.name,
        description: req.body.description,
        maxtemp: req.body.maxTemp,
        mintemp: req.body.minTemp,
        maxph: req.body.maxPh,
        minph: req.body.minPh,
        maxhum: req.body.maxHum,
        minhum: req.body.minHum,
        maxlux: req.body.maxLux,
        minlux: req.body.minLux
      })
    })
    .then(data => res.status(201).json(data))
    .catch(err => res.status(400).json(err));
  });


  // Modify an owned board
  plantsController.patch('/:id', onlyLoggedIn, (req, res) => {
    // First check if the board to be PATCHed belongs to the user making the request
    let myUser;
    return dataLoader.getUserFromSession(req.sessionToken)
    .then((user) => {

      myUser = user.users_id

      return dataLoader.plantBelongsToUser(req.params.id, user.users_id)
    })
    .then(() => {
      return dataLoader.updatePlant(req.params.id, {
        userId: myUser,
        nickname: req.body.nickname,
        name: req.body.name,
        description: req.body.description,
        maxtemp: req.body.maxTemp,
        mintemp: req.body.minTemp,
        maxph: req.body.maxPh,
        minph: req.body.minPh,
        maxhum: req.body.maxHum,
        minhum: req.body.minHum,
        maxlux: req.body.maxLux,
        minlux: req.body.minLux
      });
    })
    .then(data => res.json(data))
    .catch(err => res.status(400).json(err));
  });


  // Delete an owned board
  plantsController.delete('/:id', onlyLoggedIn, (req, res) => {
    // First check if the board to be DELETEd belongs to the user making the request
    return dataLoader.getUserFromSession(req.sessionToken)
    .then((user) => {
      return dataLoader.plantBelongsToUser(req.params.id, user.id)
    })
    .then(() => {
      return dataLoader.deleteplant(req.params.id);
    })
    .then(() => res.status(204).end())
    .catch(err => res.status(400).json(err));
  });


  return plantsController;
};
