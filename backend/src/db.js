const Datastore = require('@seald-io/nedb');
const path = require('path');
const fs = require('fs');

// Use /data on production (Render persistent disk), backend/data locally
const dbDir = process.env.NODE_ENV === 'production' 
  ? '/data' 
  : path.join(__dirname, '../data');

if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = {
  users: new Datastore({ filename: path.join(dbDir, 'users.db'), autoload: true }),
  brands: new Datastore({ filename: path.join(dbDir, 'brands.db'), autoload: true }),
  invoices: new Datastore({ filename: path.join(dbDir, 'invoices.db'), autoload: true }),
  merchants: new Datastore({ filename: path.join(dbDir, 'merchants.db'), autoload: true }),
  brandMerchants: new Datastore({ filename: path.join(dbDir, 'brand_merchants.db'), autoload: true }),
  userBrands: new Datastore({ filename: path.join(dbDir, 'user_brands.db'), autoload: true }),
  notifications: new Datastore({ filename: path.join(dbDir, 'notifications.db'), autoload: true }),
  verificationCodes: new Datastore({ filename: path.join(dbDir, 'verification_codes.db'), autoload: true }),
};

// Promisify helpers
function promisify(ds) {
  return {
    findOne: (q) => new Promise((res, rej) => ds.findOne(q, (e, d) => e ? rej(e) : res(d))),
    find: (q, sort) => new Promise((res, rej) => {
      let cursor = ds.find(q);
      if (sort) cursor = cursor.sort(sort);
      cursor.exec((e, d) => e ? rej(e) : res(d));
    }),
    insert: (doc) => new Promise((res, rej) => ds.insert(doc, (e, d) => e ? rej(e) : res(d))),
    update: (q, upd, opts = {}) => new Promise((res, rej) => ds.update(q, upd, opts, (e, n, d) => e ? rej(e) : res(opts.returnUpdatedDocs ? d : n))),
    remove: (q, opts = {}) => new Promise((res, rej) => ds.remove(q, opts, (e, n) => e ? rej(e) : res(n))),
    count: (q) => new Promise((res, rej) => ds.count(q, (e, n) => e ? rej(e) : res(n))),
  };
}

module.exports = {
  users: promisify(db.users),
  brands: promisify(db.brands),
  invoices: promisify(db.invoices),
  merchants: promisify(db.merchants),
  brandMerchants: promisify(db.brandMerchants),
  userBrands: promisify(db.userBrands),
  notifications: promisify(db.notifications),
  verificationCodes: promisify(db.verificationCodes),
};
