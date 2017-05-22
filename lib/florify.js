const bcrypt = require('bcrypt-as-promised');
const knex = require('knex')({ client: 'mysql' });
const validate = require('./validations');
const util = require('./util');
const moment = require('moment');
moment().format();

const HASH_ROUNDS = 10;

const PLANT_FIELDS = ['id', 'userId', 'nickname', 'name', 'description', 'maxtemp', 'mintemp',
'maxph', 'minph', 'maxhum', 'minhum', 'maxlux', 'minlux', 'createdAt', 'updatedAt'];
const PLANT_WRITE_FIELDS = ['userId', 'nickname', 'name', 'description', 'maxtemp', 'mintemp',
'maxph', 'minph', 'maxhum', 'minhum', 'maxlux', 'minlux'];
const USER_FIELDS = ['id', 'email', 'phone'];
const DATA_FIELDS = ['id', 'plantId', 'type', 'reading', 'createdAt'];

class FlorifyDataLoader {
  constructor(conn) {
    this.conn = conn;
  }

  query(sql) {
    return this.conn.query(sql);
  }

  getUser(userId){

    if (userId) {
      return this.query(
        knex
        .select(USER_FIELDS)
        .from('users')
        .where('id', userId)
        .toString()
      )
    } else {
      return this.query(
        knex
        .select(USER_FIELDS)
        .from('users')
        .toString()
      )
    }
  }

  // User methods
  createUser(userData) {
    // console.log(userData, "blabla");
    const errors = validate.user(userData);
    if (errors) {
      // console.log("hihi");
      return Promise.reject({ errors: errors });
    }

    return bcrypt.hash(userData.password, HASH_ROUNDS)
    .then((hashedPassword) => {
      // if (!userData.phone){
      //   userData.phone = null;
      // }
      // console.log(hashedPassword);
      return this.query(
        knex
        .insert({
          email: userData.email,
          phone: userData.phone || null,
          password: hashedPassword
        })
        .into('users')
        .toString()
      )
    })
    .then((result) => {
      // console.log(result, "boogie");
      return this.query(
        knex
        .select(USER_FIELDS)
        .from('users')
        .where('id', result.insertId)
        .toString()
      );
    })
    .then(result => result[0])
    .catch((error) => {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('A user with this email already exists');
      } else {
        throw error;
      }
    });
  }

  getUserFromSession(sessionToken) {
    //delete next line
    // sessionToken = 'vpMj1CZ2sxmXyuUzwzPBQanp39lNcp2lVNitQ1Ro1sWR2b7IklmM8nDJldVhBHEm5YE=';
    return this.query(
      knex
      .select(util.joinKeys('users', USER_FIELDS))
      .from('sessions')
      .join('users', 'sessions.userId', '=', 'users.id')
      .where({
        'sessions.token': sessionToken
      })
      .toString()
    )
    .then((result) => {
      console.dir(result[0], { depth: null });
      if (result.length === 1) {
        return result[0];
      }

      return null;
    });
  }

  createTokenFromCredentials(email, password) {
    const errors = validate.credentials({
      email: email,
      password: password
    });
    if (errors) {
      return Promise.reject({ errors: errors });
    }

    let sessionToken;
    let user;
    return this.query(
      knex
      .select('id', 'password')
      .from('users')
      .where('email', email)
      .toString()
    )
    .then((results) => {
      if (results.length === 1) {
        user = results[0];
        return bcrypt.compare(password, user.password).catch(() => false);
      }

      return false;
    })
    .then((result) => {
      if (result === true) {
        return util.getRandomToken();
      }

      throw new Error('Username or password invalid');
    })
    .then((token) => {
      sessionToken = token;
      return this.query(
        knex
        .insert({
          userId: user.id,
          token: sessionToken
        })
        .into('sessions')
        .toString()
      );
    })
    .then(() => sessionToken);
  }

  deleteToken(token) {
    return this.query(
      knex
      .delete()
      .from('sessions')
      .where('token', token)
      .toString()
    )
    .then(() => true);
  }


  // Plant methods
  getPlants(userId) {
    let plantsArray = []
    return this.query(
      knex
      .select(PLANT_FIELDS)
      .from('plants')
      .where('userId', userId)
      .toString()
    )
    .then(plants => {
      plantsArray = plants
      return Promise.all(
        plants.map(plant => {
          return this.query(
            knex
            .select(['type', 'reading'])
            .from('data')
            .where('plantId', plant.id)
            .limit(10)
            .orderBy('createdAt', 'desc')
            .toString()
          )
        })
      )
      .then(plantsReadings => {
        return plantsArray.map((plant, i) => {
          return Object.assign(plant, {
              latestHum: plantsReadings[i].find(p => p.type==='hum'),
              latestTemp: plantsReadings[i].find(p => p.type==='temp'),
              latestLux: plantsReadings[i].find(p => p.type==='lux'),
              latestPh: plantsReadings[i].find(p => p.type==='ph')
          })
        })
      })
    })
  }

  getSinglePlant(id, timePeriod) {
    let plant = {};
    let pastMoment
    let timeArray = []
    // adjust to california time for access to cloud sql server
    let now = moment().subtract(3, 'hours')
    console.log(timePeriod, 'timeperiod');
    if (timePeriod === 'hour'){
      pastMoment = now.subtract(1, 'hours')
      for(var i = 0; i<60; i++) {
        timeArray.push(moment(pastMoment).add(i+1, 'minutes'))
      }
    }
    if (timePeriod === 'day'){
      pastMoment = now.subtract(1, 'days')
      for(var i = 0; i<24; i++) {
        timeArray.push(moment(pastMoment).add(i+1, 'hours'))
      }
    }
    if (timePeriod === 'week'){
      pastMoment = now.subtract(1, 'weeks')
      console.log(pastMoment, 'past moment')
      for(var i = 1; i<=14; i++) {
        timeArray.push(moment(pastMoment).add(i*12, 'hours'))
      }
      console.log(timeArray, 'timeArray');
    }
    if (timePeriod === 'month'){
      pastMoment = now.subtract(30, 'days')
      for(var i = 0; i<30; i++) {
        timeArray.push(moment(pastMoment).add(i+1, 'days'))
      }
    }
    let sqlPastMoment = pastMoment.format('YYYY/MM/DD HH:mm:ss');
    return this.query(
      knex
      .select(PLANT_FIELDS)
      .from('plants')
      .where('id', id)
      .toString()
    )
    .then(result => {
      plant = result[0];
      return this.query(
        knex
        .select(DATA_FIELDS)
        .from('data')
        .where('plantId', id)
        .andWhere('createdAt', '>', sqlPastMoment)
        .toString()
      )
    })
    .then(datapoints => {
      const average = arr => arr.reduce((p, c) => p+c, 0) / arr.length;

      let averagedData = timeArray.reduce((acc, time) => {

        let hum = [];
        let temp = [];
        let ph = [];
        let lux = [];

        datapoints.forEach(point => {
          if(moment(point.createdAt).format('X') < moment(time).format('X')) {
            if (point.type === 'temp') temp.push(point.reading)
            if (point.type === 'lux') lux.push(point.reading)
            if (point.type === 'hum') hum.push(point.reading)
            if (point.type === 'ph') ph.push(point.reading)
          }
        })
        console.log(average(hum), "average of humidity");
        acc.hum.push(average(hum))
        acc.temp.push(average(temp))
        acc.ph.push(average(ph))
        acc.lux.push(average(lux))
        return acc

      }, { hum:[], temp:[], ph:[], lux:[] })

      averagedData.timeAxis = timeArray
      averagedData.plant = plant;
      console.log("return state", averagedData);
      return averagedData;
    })
  }

  createData(plantId, type, reading) {
    if (type === 'temp'){
      reading = reading/10;
    }

    if(type === 'hum'){
      this.checkIfLowHumidity(plantId, reading);
    }

    return this.query(
      knex
      .insert({plantId: plantId, type: type, reading: reading})
      .into('data')
      .toString()
    )
  }

  checkIfLowHumidity(plantId, reading){

    return this.query(
      knex
      .select('minhum')
      .from('plants')
      .where('id', plantId)
      .toString()
    )
    .then(result=>{
      if(result[0].minhum){
        if (result[0].minhum > reading){
          console.log("the humidity is too low for plant ID:", plantId)
        }
      }

    })
  }

  createPlant(plantData) {
    // console.log(util.filterKeys(PLANT_WRITE_FIELDS, plantData), "hurrr")

    // const errors = validate.plant(plantData);
    //
    // if (errors) {
    //   console.log(errors)
    //   return Promise.reject({ errors: errors });
    // }
    return this.query(
      knex
      .insert(util.filterKeys(PLANT_WRITE_FIELDS, plantData))
      .into('plants')
      .toString()
    )
    .then((result) => {
      return this.query(
        knex
        .select(PLANT_FIELDS)
        .from('plants')
        .where('id', result.insertId)
        .toString()
      );
    });
  }

  plantBelongsToUser(plantId, userId) {

    return this.query(
      knex
      .select('id')
      .from('plants')
      .where({
        id: plantId,
        userId: userId
      })
      .toString()
    )
    .then((results) => {
      if (results.length === 1) {
        return true;
      }

      throw new Error('Access denied');
    });
  }

  updatePlant(plantId, plantData) {


    return this.query(
      knex('plants')
      .update(util.filterKeys(PLANT_WRITE_FIELDS, plantData))
      .where('id', plantId)
      .toString()
    )
    .then(() => {
      return this.query(
        knex
        .select(PLANT_FIELDS)
        .from('plants')
        .where('id', plantId)
        .toString()
      );
    });
  }

  deletePlant(plantId) {
    return this.query(
      knex
      .delete()
      .from('plants')
      .where('id', plantId)
      .toString()
    );
  }


}

module.exports = FlorifyDataLoader;
