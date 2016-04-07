var MongoClient = require('./').MongoClient,
  ReadPreference = require('./').ReadPreference;

var uri = "mongodb://admin:admin@localhost:27017,localhost:27018/admin";
var uri = "mongodb://localhost:31000,localhost:31001/test?replicaSet=rs";
var uri = "mongodb://muser:mpass@ds015510-a0.mlab.com:15510,ds015510-a1.mlab.com:15510/test?replicaSet=rs-ds015510";
var interval = 500;
var i = 0;

var openThenClose = function(){
  i = i + 1;

  // if(i == 100) {
  if(i == 100) {
    clearInterval(intervalId);
    setInterval(function() {
      console.log('wait for drain');
    }, interval);
  }

  console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! MongoClient.connect")
  MongoClient.connect(uri, {
    // replSet: {
    //   socketOptions: {
    //     connectTimeoutMS: 2000, socketTimeoutMS: 2000
    //   }
    // }
  }, function(err, db) {
    console.log("open");
    var descriptors = db.collection("collection").find().setReadPreference(ReadPreference.SECONDARY).batchSize(2);
    descriptors.toArray(function(err, docs){
      console.log("-------------------------------------------------")
      db.serverConfig.connections().forEach(function(x) {
        console.log("--- " + x.host)
      })
      // console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! toArray")
      // console.dir(err)
      // console.dir(docs)
      db.close(function(){
        // console.log("close");
        console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! close")
      });
    });
  });
};

// openThenClose();
var intervalId = setInterval(function(){
  openThenClose();
}, interval);

// var start = null;
//
// console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$ CLOSE 0")
// MongoClient.connect('mongodb://localhost:31000/test?replicaSet=rs', {
//   replSet: {
//     socketOptions: {
//       connectTimeoutMS: 2000, socketTimeoutMS: 2000
//     }
//   }
//
// }, function(err, db) {
//   console.log(err)
//   start = new Date().getTime();
//   console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$ CLOSE 1")
//   db.close();
// });
//
// process.on('exit', function() {
//   console.log("--------- exit :: " + (new Date().getTime() - start));
// });
// MongoClient.connect('mongodb://localhost:51000,localhost:51001/test', {
//   mongos: {
//     poolSize: 100
//   },
//   acceptableLatencyMS: 100
// }, function(err, db) {
//   const collection = db.collection("tempCollection");
//
//   collection.remove({}, (err) => {
//     if (err) return console.trace(err);
//
//     collection.createIndexes([{key: {number: 1}}], (err) => {
//       const documents = [];
//       for (var i = 0; i < 30000; i++) {
//         documents.push({number: i % 15, prop: '+ftnmrzxEcb+0wCcZjC/YWKP5K0M33FC+FyTaPKxCbyEkFWmXgdU+QW7I6HxDmUPjN8='})
//       }
//
//       collection.insertMany(documents, (err) => {
//         if (err) return console.trace(err);
//         console.log("finish inserting documents...");
//
//         setInterval(function() {
//           collection.find({number: 2}).toArray((err, results) => {
//             if (err) return console.trace(err);
//             console.log("got", results.length, "results");
//           })
//
//           collection.find({number: 2}).toArray((err, results) => {
//             if (err) return console.trace(err);
//             console.log("got", results.length, "results");
//           })
//
//           collection.find({number: 2}).toArray((err, results) => {
//             if (err) return console.trace(err);
//             console.log("got", results.length, "results");
//           })
//
//           collection.find({number: 2}).toArray((err, results) => {
//             if (err) return console.trace(err);
//             console.log("got", results.length, "results");
//           })
//
//           collection.find({number: 2}).toArray((err, results) => {
//             if (err) return console.trace(err);
//             console.log("got", results.length, "results");
//           })
//
//           collection.find({number: 2}).toArray((err, results) => {
//             if (err) return console.trace(err);
//             console.log("got", results.length, "results");
//           })
//
//           collection.find({number: 2}).toArray((err, results) => {
//             if (err) return console.trace(err);
//             console.log("got", results.length, "results");
//           })
//
//           collection.find({number: 2}).toArray((err, results) => {
//             if (err) return console.trace(err);
//             console.log("got", results.length, "results");
//           })
//
//           collection.find({number: 3000}).toArray((err, results) => {
//             if (err) return console.trace(err);
//             console.log("got", results.length, "results");
//           })
//
//           collection.find({number: 3000}).toArray((err, results) => {
//             if (err) return console.trace(err);
//             console.log("got", results.length, "results");
//           })
//
//           collection.find({number: 3000}).toArray((err, results) => {
//             if (err) return console.trace(err);
//             console.log("got", results.length, "results");
//           })
//         }, 200);
//       })
//     })
//   })
// });

// MongoClient.connect('mongodb://localhost:31000,localhost:31001,localhost:31002/test?rs_name=rs&maxPoolSize=100', {
//   replSet: {
//     socketOptions: {
//       connectTimeoutMS: 2000,
//       socketTimeoutMS: 2000,
//     },
//     // haInterval: 1500
//   }
// }, function(err, db) {
//   console.dir(err)
//
//   db.serverConfig.on('timeout', function() {
//     console.log("----- timeout")
//   })
//
//   db.serverConfig.on('close', function() {
//     console.log("----- close")
//   })
// MongoClient.connect('mongodb://localhost:31000/test?maxPoolSize=100', function(err, db) {
  // console.dir(err)
  //
  // db.on('reconnect', function() {
  //   console.log('reconnect', new Error().stack)
  // });
  //
  // setInterval(function() {
  //   db.collection('t').insertOne({a:1}, function(e) {
  //     // console.log("------ insert")
  //     // console.dir(e)
  //   });
  // }, 1)
  //
  // var doit = true;
  //
  // setInterval(function() {
  //   if(!doit) return
  //   console.log("-------------------------------------")
  //   // // force a reconnect
  //   // var replset = db.serverConfig.s.replset;
  //   // var state = replset.s.replState;
  //   // var connections = state.primary.connections();
  //   var connections = db.serverConfig.connections();
  //
  //   for(var i = 0; i < connections.length; i++) {
  //     connections[i].connection.write("da12123123213213123233123213123123123123asdacsdcdv ")
  //   }
  // }, 5000);

  // setInterval(function() {
  //   doit = false;
  //
  //   // db.close();
  // }, 10000);

  // db.close();
// })
