var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authJwtController = require('./auth_jwt');
var User = require('./Users');
var Movie = require('./movies');
var Review = require('./reviews');
var jwt = require('jsonwebtoken');
var cors = require("cors");

var app = express();
module.exports = app; // for testing
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());
app.use(cors());

var router = express.Router();

router.route('/postjwt')
    .post(authJwtController.isAuthenticated, function (req, res) {
            console.log(req.body);
            res = res.status(200);
            if (req.get('Content-Type')) {
                console.log("Content-Type: " + req.get('Content-Type'));
                res = res.type(req.get('Content-Type'));
            }
            res.send(req.body);
        }
    );

router.route('/users/:userId')
    .get(authJwtController.isAuthenticated, function (req, res) {
        var id = req.params.userId;
        User.findById(id, function(err, user) {
            if (err) res.send(err);

            var userJson = JSON.stringify(user);
            // return that user
            res.json(user);
        });
    });

router.route('/users')
    .get(authJwtController.isAuthenticated, function (req, res) {
        User.find(function (err, users) {
            if (err) res.send(err);
            // return the users
            res.json(users);
        });
    });

router.post('/signup', function(req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({success: false, message: 'Please pass username and password.'});
    }
    else {
        var user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;
        // save the user
        user.save(function(err) {
            if (err) {
                // duplicate entry
                if (err.code == 11000)
                    return res.json({ success: false, message: 'A user with that username already exists. '});
                else
                    return res.send(err);
            }

            res.json({ success: true, message: 'User created!' });
        });
    }
});

router.post('/signin', function(req, res) {
    var userNew = new User();
    userNew.name = req.body.name;
    userNew.username = req.body.username;
    userNew.password = req.body.password;

    User.findOne({ username: userNew.username }).select('name username password').exec(function(err, user) {
        if (err) res.send(err);

        user.comparePassword(userNew.password, function(isMatch){
            if (isMatch) {
                var userToken = {id: user._id, username: user.username};
                var token = jwt.sign(userToken, process.env.SECRET_KEY);
                res.json({success: true, token: 'JWT ' + token});
            }
            else {
                res.status(401).send({success: false, message: 'Authentication failed.'});
            }
        });


    });
});

router.route('/movies')
    .post(authJwtController.isAuthenticated, function(req, res) {
        Movie.findOne( { title: req.body.title }, function(err) {
            if (err) {
                res.json({message: 'General error'});
            } else if (req.body.actors.length < 3) {
                res.json({message: 'Actor array needs at least 3 actors'});
            } else if (req.data !== 0) {
                var movie = new Movie();
                movie.title = req.body.title;
                movie.releaseYear = req.body.releaseYear;
                movie.genre = req.body.genre;
                movie.imageUrl = req.body.imageUrl;
                movie.actors = req.body.actors;
                // save the user
                movie.save(function (err) {
                    if (err) {
                        // duplicate entry
                        if (err.code == 11000)
                            return res.json({success: false, message: 'A movie already exists with that title.'});
                        else
                            return res.send(err);
                    }

                    res.json({success: true, message: 'Movie created!'});
                });
            }
        })
    })
    .put(authJwtController.isAuthenticated, function(req, res) {
        Movie.findOneAndUpdate( { title: req.body.title },
            {
                title: req.body.title,
                releaseYear: req.body.releaseYear,
                genre: req.body.genre,
                imageUrl: req.body.imageUrl,
                actors: req.body.actors,
            },
            function(err) {
                if (err) {
                    res.json({message: 'General error'});
                } else if (req.data === 0) {
                    res.json({message: 'Movie could not be found'});
                } else {
                    res.json({message: 'Movie was successfully updated'})
                }
            })
    })
    .delete(authJwtController.isAuthenticated, function(req, res) {
        Movie.findOneAndDelete( { title: req.body.title }, function(err) {
            if (err) {
                res.json({message: 'General error'});
            } else if (req.data === null) {
                res.json({message: 'Movie could not be found'});
            } else {
                res.json({message: 'Movie was successfully deleted'})
            }
        })
    })
    .get(authJwtController.isAuthenticated, function(req, res) {
        if ( req.query.movieId != null) {
            Movie.findOne( { _id: req.query.movieId }, function(err, data) {
                if (err) {
                    res.json({message: 'General error'});
                } else if (req.data === 0) {
                    res.json({message: 'Movie could not be found'});
                } else {
                    if (req.query.reviews === "true") {
                        console.log("Movie aggregate ;)");
                        Movie.aggregate([
                            {
                                $match: {'_id': req.query.movieId}
                            },
                            {
                                $lookup: {
                                    from: 'reviews',
                                    localField: 'title',
                                    foreignField: 'movieTitle',
                                    as: 'reviews'
                                }
                            }
                        ], function (err, doc) {
                            if (err) {
                                res.send(err);
                            } else {
                                res.json({movie_info: doc, message: 'Movie found'});
                            }
                        });
                    }
                }
            })
        } else {
                    Movie.find({}, function (err) {
                        if (err) {
                            res.json({message: 'Error'});
                        } else {
                            Movie.aggregate([
                                {
                                    $lookup: {
                                        from: 'reviews',
                                        localField: 'title',
                                        foreignField: 'movieTitle',
                                        as: 'reviews'
                                    }
                                }
                            ], function (err2, movieList) {
                                if (err2) {
                                    console.log(err2);
                                } else {
                                    res.json(movieList);
                                }
                            });
                        }
                    })
        }
    });

router.route('/reviews')
    .post(authJwtController.isAuthenticated, function(req, res) {

        let token1 = req.headers.authorization;
        let token2 = token1.split(' ');
        let token3 = jwt.verify(token2[1], process.env.SECRET_KEY);

        Movie.findOne( { title: req.body.movieTitle }, function(err, data) {
            if (err) {
                res.json({message: 'General error'});
            } else if (data != null) {
                var review = new Review();
                review.name = token3.username;
                review.quote = req.body.quote;
                review.rating = req.body.rating;
                review.movieTitle = req.body.movieTitle;
                // save the user
                review.save(function (err) {
                    if (err) {
                            return res.send(err);
                    }

                    res.json({success: true, message: 'Review created!'});
                });
            } else {
                res.json({message: 'Movie does not exist'});
            }
        })
    })
    .get(authJwtController.isAuthenticated, function(req, res) {
        Review.find( { name: req.body.name }, function(err, data) {
            if (err) {
                res.json({message: 'General error'});
            } else if (req.data === 0) {
                res.json({message: 'Review could not be found'});
            } else {
                res.json({review_data: data, message: "Found review!"});
            }
        })
    });



router.all('*', function(req, res) {
    res.json({success: false, message: 'HTTP method unsupported'});
});


app.use('/', router);
app.listen(process.env.PORT || 8080);
