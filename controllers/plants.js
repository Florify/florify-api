const express = require('express');

const onlyLoggedIn = require('../lib/only-logged-in');

module.exports = (dataLoader) => {

  const plantsController = express.Router();

  // Retrieve a list of boards
  // plantsController.get('/', onlyLoggedIn, (req, res) => {
  plantsController.get('/', (req, res) => {
    return dataLoader.getUserFromSession(req.sessionToken).then((user) => {
      // console.log(user, "blablabla");
      return dataLoader.getPlants(user.users_id);
    })
    .then(data => res.json(data)).catch(err => res.status(400).json(err));
  });

  // Retrieve a single board
  plantsController.get('/:id/:time', onlyLoggedIn, (req, res) => {
    // dataLoader.getSinglePlant(req.params.id)
    // .then(result=> {console.log(result, "sexy")})
    // console.log(res, 'who are you');
    // console.log(req.params.id, req.params.time, "ello mate");
    return dataLoader.getSinglePlant(req.params.id, req.params.time)
    .then(data => res.json(data))
    .catch(err => res.status(400).json(err));
  });

  // post data
  plantsController.post('/:id/:type/:reading', (req, res) => {
    return dataLoader.createData(req.params.id, req.params.type, req.params.reading)
    .then(data => res.json(data))
    .catch(err => {return res.status(400).json(err)});
  });
  // Create a new board
  plantsController.post('/', onlyLoggedIn, (req, res) => {
    return dataLoader.getUserFromSession(req.sessionToken).then((user) => {
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
      });
    }).then(data => res.status(201).json(data)).catch(err => res.status(400).json(err));
  });

  // Modify an owned board
  plantsController.patch('/:id', onlyLoggedIn, (req, res) => {
    // First check if the board to be PATCHed belongs to the user making the request
    let myUser;
    return dataLoader.getUserFromSession(req.sessionToken).then((user) => {
      myUser = user.users_id;
      // console.log(myUser, "myUser");
      // console.log(req.body, "the body");
      return dataLoader.plantBelongsToUser(req.params.id, user.users_id);
    })
    .then(() => {
      // console.log(req.body, "hello", req.params.id, myUser, req.body);
      return dataLoader.updatePlant(req.params.id, {
        userId: myUser,
        nickname: req.body.nickname,
        name: req.body.name,
        description: req.body.description,
        maxtemp: req.body.maxTemp,
        mintemp: req.body.minTemp,
        maxph: req.body.maxph,
        minph: req.body.minph,
        maxhum: req.body.maxhum,
        minhum: req.body.minhum,
        maxlux: req.body.maxlux,
        minlux: req.body.minlux
      });
    })
    .then((data) => {
      // console.log(data, "heel then line 93");
      return res.json(data);
    })
    .catch((err) => {
      // console.log(err, "heel then line 96");
      return res.status(400).json(err);
    });
  });

  // Delete an owned board
  plantsController.delete('/:id', onlyLoggedIn, (req, res) => {
    // First check if the board to be DELETEd belongs to the user making the request
    return dataLoader.getUserFromSession(req.sessionToken)
    .then(user => dataLoader.plantBelongsToUser(req.params.id, user.users_id))
    .then(() => dataLoader.deletePlant(req.params.id))
    .then(() => res.status(204).end())
    .catch(err => res.status(400).json(err));
  });

  return plantsController;
};
