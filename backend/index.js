var express = require('express');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json())
mongoose.set('useFindAndModify', false);

var port = 4000;

// Connect to the 'testPlacesDb' database
mongoose.connect("mongodb://localhost/testPlacesDb");

// Define data schema
var PlaceSchema = new Schema({
  googleID: String,
  name: String,
  rating: Number
});
var UserSchema = new Schema({
  _id: String,
  name: String,
  visitedPlaces: [PlaceSchema],
  groups: [[String]]
});
var Place = mongoose.model('Place', PlaceSchema);
var User = mongoose.model('User', UserSchema);

// API Routes
app.post('/addUser', async function(req, res) {
  var returnMessage;
  var user = new User({ _id: req.body.username, name: req.body.name, visitedPlaces: [], groups: [[]] });
  await user.save(function (err) {
    console.log("Error: " + err);
    if (err) {
      res.send("Must choose a username that has not been taken by another user");
    } else {
      res.send(user);
      console.log('Added user ' + req.body.name);
    }
  });
});
app.post('/addGroup', async function(req, res) {
  
});
app.get('/getUser', async function(req, res) {
  await User.findOne({ _id: req.body.username }, async function(err, results) {
    if (err || !results) {
      res.send('Cannot find user: \'' + req.body.username + '\'');
    } else {
      res.send(results);
    }
  });
});
app.post('/addPlace', async function(req, res) {
  await User.findOne({ _id: req.body.username }, async function(err, results) {
    if (err) return err;
    const correctPlace = []
    // Get the list of existing 
    results.visitedPlaces.forEach(place => {
      if (place.googleID === req.body.googleID) {
        correctPlace.push(place);
      }
    });
    if (!correctPlace.length) {
      // User does not already have this place, add it to visitedPlaces
      console.log("User does not already have this place");
      var place = new Place({ googleID: req.body.googleID, name: req.body.name, rating: req.body.rating });
      await User.findOneAndUpdate({ _id: req.body.username }, { $push: { visitedPlaces: place }});
      res.send('Added place (Google ID): ' + req.body.googleID + ' to user ' + req.body.username);
    } else {
      // User already has this place, update existing item
      console.log("User already has this place");
      await User.findOneAndUpdate({ "visitedPlaces.googleID": req.body.googleID, _id: req.body.username }, {$set: {
        'visitedPlaces.$.name': req.body.name,
        'visitedPlaces.$.rating': req.body.rating
      }});
      res.send('Updated place (Google ID): ' + req.body.googleID + ' for user ' + req.body.username);
    }
  });
});
app.delete('/removePlace', async function(req, res) {
  await User.update( { _id: req.body.username }, { $pull: { visitedPlaces: { googleID: req.body.googleID }}});
  res.send('Successfully removed place (Google ID): ' + req.body.googleID);
});

mongoose.connection.once("open", function() {
  // Start the server
  app.listen(port);
  console.log('Server started at port ' + port);
});