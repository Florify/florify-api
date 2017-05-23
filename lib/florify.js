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

  query(sql, params) {
    return this.conn.query(sql, params);
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
      // console.dir(result[0], { depth: null });
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
    let timeIntervalInHours;
    let timeConstant;
    if (timePeriod === 'day'){
      timeIntervalInHours = 24;
      timeConstant = 3600;
    }
    if (timePeriod === 'week'){
      timeIntervalInHours = 24 * 7;
      timeConstant = 3600 * 7;
    }
    if (timePeriod === 'month'){
      timeIntervalInHours = 24 * 30;
      timeConstant = 3600 * 30;
    }
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
        `
        select type, AVG(reading),
        FROM_UNIXTIME(FLOOR(unix_timestamp(createdAt)/?)*?) as startTime
        FROM data where createdAt >= DATE_SUB(NOW(), INTERVAL ? HOUR)
        GROUP BY type, startTime;
        `,
        [timeConstant, timeConstant, timeIntervalInHours]
      )
    })
    .then( datapoints => {
      let averagedData = datapoints.reduce((finalData, currentPoint) => {
        finalData[currentPoint.type] = finalData[currentPoint.type] || [];
        finalData[currentPoint.type].push(currentPoint);
        return finalData;
      }, {});
      averagedData.plant = plant;
      return averagedData;
    })
    .catch(console.error)
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
          // console.log("the humidity is too low for plant ID:", plantId)
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
