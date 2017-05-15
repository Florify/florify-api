const bcrypt = require('bcrypt-as-promised');
const knex = require('knex')({ client: 'mysql' });
const validate = require('./validations');
const util = require('./util');

const HASH_ROUNDS = 10;

const PLANT_FIELDS = ['id', 'userId', 'nickname', 'name', 'description', 'maxtemp', 'mintemp',
'maxph', 'minph', 'maxhum', 'minhum', 'maxlux', 'minlux', 'createdAt', 'updatedAt'];


class FlorifyDataLoader {
  constructor(conn) {
    this.conn = conn;
  }

  query(sql) {
    return this.conn.query(sql);
  }

  // User methods
  createUser(userData) {
    const errors = validate.user(userData);
    if (errors) {
      return Promise.reject({ errors: errors });
    }

    return bcrypt.hash(userData.password, HASH_ROUNDS)
    .then((hashedPassword) => {
      return this.query(
        knex
        .insert({
          email: userData.email,
          phone: userData.phone || null,
          password: hashedPassword
        })
        .into('users')
        .toString()
      );
    })
    .then((result) => {
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

  getSinglePlant(id) {
    let plant = {};

    return this.query(
      knex
      .select(PLANT_FIELDS)
      .from('plants')
      .where('id', id)
      .toString()
    )
    .then(result =>{
      plant = result;
      plant.readings = {};
      return this.query(
        knex
        .select(DATA)
        .from('data')
        .where('plantId', id)
        .toString()
      )
      .then(datapoints => {
        plant.readings.temp = datapoints.filter((point)=>{
          if (point.type === 'temperature'){
            return point;
          }
        })
        plant.readings.lux = datapoints.filter((point)=>{
          if (point.type === 'lux'){
            return point;
          }
        })
        plant.readings.humidity = datapoints.filter((point)=>{
          if (point.type === 'humidity'){
            return point;
          }
        })
        plant.readings.ph = datapoints.filter((point)=>{
          if (point.type === 'ph'){
            return point;
          }
        })
        return plant;
      })
    })
  }

  createBoard(boardData) {
    const errors = validate.board(boardData);
    if (errors) {
      return Promise.reject({ errors: errors });
    }

    return this.query(
      knex
      .insert(util.filterKeys(BOARD_WRITE_FIELDS, boardData))
      .into('boards')
      .toString()
    )
    .then((result) => {
      return this.query(
        knex
        .select(BOARD_FIELDS)
        .from('boards')
        .where('id', result.insertId)
        .toString()
      );
    });
  }

  boardBelongsToUser(boardId, userId) {
    return this.query(
      knex
      .select('id')
      .from('boards')
      .where({
        id: boardId,
        ownerId: userId
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

  updateBoard(boardId, boardData) {
    console.log('123');
    const errors = validate.boardUpdate(boardData);
    if (errors) {
      return Promise.reject({ errors: errors });
    }

    return this.query(
      knex('boards')
      .update(util.filterKeys(BOARD_WRITE_FIELDS, boardData))
      .where('id', boardId)
      .toString()
    )
    .then(() => {
      return this.query(
        knex
        .select(BOARD_FIELDS)
        .from('boards')
        .where('id', boardId)
        .toString()
      );
    });
  }

  deleteBoard(boardId) {
    return this.query(
      knex
      .delete()
      .from('boards')
      .where('id', boardId)
      .toString()
    );
  }

  // Bookmark methods
  getAllBookmarksForBoard(options) {
    // TODO: this is up to you to implement :)
    const page = Number(options.page) || 1;
    const limit = Number(options.limit) || 9;
    const offset = (page - 1) * limit;

    return this.query(
      knex
      .select(BOOKMARK_FIELDS)
      .from('bookmarks')
      .where('id', options.boardId)
      .limit(limit)
      .offset(offset)
      .toString()
    );
  }

  createBookmark(bookmarkData) {
    return this.query(
      knex
      .insert(util.filterKeys(BOOKMARK_WRITE_FIELDS, bookmarkData))
      .into('bookmarks')
      .toString()
    )
    .then((result) => {
      return this.query(
        knex
        .select(BOOKMARK_FIELDS)
        .from('bookmarks')
        .where('id', result.insertId)
        .toString()
      );
    });
  }

  bookmarkBelongsToUser(bookmarkId, userId) {
    return this.query(
      knex
      .select('bookmarks.id')
      .from('bookmarks')
      .join('boards', 'bookmarks.boardId', '=', 'boards.id')
      .where({
        'bookmarks.id': bookmarkId,
        'boards.ownerId': userId
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

  updateBookmark(bookmarkData) {
    return this.query(
      knex('bookmarks')
      .update(util.filterKeys(BOOKMARK_WRITE_FIELDS, bookmarkData))
      .where('id', bookmarkData.id)
      .toString()
    )
    .then(() => {
      return this.query(
        knex
        .select(BOOKMARK_FIELDS)
        .from('bookmarks')
        .where('id', bookmarkData.id)
        .toString()
      );
    })
    .then(result => result[0]);
  }

  deleteBookmark(bookmarkId) {
    console.log(bookmarkId, 'book');
    return this.query(
      knex
      .delete()
      .from('bookmarks')
      .where('id', bookmarkId)
      .toString()
    );
  }
}

module.exports = DashboardlyDataLoader;
