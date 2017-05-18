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
      console.log(hashedPassword);
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
      console.log(result, "boogie");
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
    sessionToken = 'vpMj1CZ2sxmXyuUzwzPBQanp39lNcp2lVNitQ1Ro1sWR2b7IklmM8nDJldVhBHEm5YE=';
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

    return this.query(
      knex
      .select(PLANT_FIELDS)
      .from('plants')
      .where('userId', userId)
      .toString()
    );
  }

  getSinglePlant(id, timePeriod) {
    let pastMoment
    let timeArray = []
    if (timePeriod === 'hour'){
      pastMoment = moment().subtract(1, 'hours')
      for(var i = 0; i<60; i++) {
        timeArray.push(moment(pastMoment).add(i+1, 'minutes'))
      }
    }
    if (timePeriod === 'day'){
      pastMoment = moment().subtract(1, 'days')

    }
    if (timePeriod === 'week'){
      pastMoment = moment().subtract(1, 'weeks')
    }
    if (timePeriod === 'month'){
      pastMoment = moment().subtract(1, 'months')
    }
    let sqlPastMoment = pastMoment.format('YYYY/MM/DD HH:mm:ss');
    return this.query(
      knex
      .select(PLANT_FIELDS)
      .from('plants')
      .where('id', id)
      .toString()
    )
    .then(result =>{
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

        acc.hum.push(average(hum))
        acc.temp.push(average(temp))
        acc.ph.push(average(ph))
        acc.lux.push(average(lux))

        return acc

      }, { hum:[], temp:[], ph:[], lux:[] })

      averagedData.timeAxis = timeArray

      return averagedData;
    })
  }

  createData(plantId, type, reading) {
    if (type === 'temp'){
      reading = reading/10;
    }
    return this.query(
      knex
      .insert({plantId: plantId, type: type, reading: reading})
      .into('data')
      .toString()
    )
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
// will I need this?
  plantBelongsToUser(plantId, userId) {
    console.log(plantId, userId, "toodooloo");
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
      console.log(results, "GRRR");
      if (results.length === 1) {
        return true;
      }

      throw new Error('Access denied');
    });
  }

  updatePlant(plantId, plantData) {
    // console.log('123', plantId, plantData);
    // const errors = validate.plantUpdate(plantData);
    // if (errors) {
    //   return Promise.reject({ errors: errors });
    // }
    // console.log(plantId, plantData, "HELLOOOOO")

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
