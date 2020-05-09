var express = require("express"),
    router = express.Router(),
    xmlBuilder = require("xmlBuilder"),
    News = require("../lib/models/news"),
    User = require("../lib/models/user");

const numOfNewsToSend = 20;


// landing - route
router.get("/", function(req, res){
    res.redirect("/news");
})


// show news page - route
router.get("/news", function(req, res){

    // if the client isn't authenticated, render the latest news
    if(!req.isAuthenticated()){
        News.find({}).sort({date: -1}).limit(numOfNewsToSend).then(news => {
            res.render("index", {news: news});
        })
    }

    // else find the news related to the user topics interests
    else {
        User.findById(req.user._id, function(err, user){
            if (err || !user) return res.render("error", {error: "404"});

            // find the users interest topics
            var topics = user.interests;

            if (topics.length !== 0) {
                // find and render the latest news containing the specefied topics
                News.find({ topics: { "$in" : topics }}).sort({date: -1}).limit(numOfNewsToSend).then(news => {
                    res.render("index", {news: news});
                })
            } else {
                // if the user has no interests, show the latest news
                News.find({}).sort({date: -1}).limit(numOfNewsToSend).then(news => {
                    res.render("index", {news: news});
                })
            }
        })
    }

})


// find the news in the database based on topics and send a xml document - route
router.post("/news/find", function(req, res){

    // what to do if no topics are passed
    if(!req.query.topics || req.query.topics === ""){
        
        // find and send the latest news
        News.find({}).sort({date: -1}).limit(numOfNewsToSend).then(news => {
            res.set('Content-Type', 'text/xml');
            res.send(generateNewsXML(news));
        })
    } 
    
    // what to do if topics are passed
    else {

        // obtain an array of topics (they must be passed through the query in the form topics=economy-politics-...)
        var topics = req.query.topics.split("-");

        // find and sent the latest news containing the specefied topics
        News.find({ topics: { "$in" : topics }}).sort({date: -1}).limit(numOfNewsToSend).then(news => {
            
            res.set('Content-Type', 'text/xml');
            res.send(generateNewsXML(news));
            
        })

    }
})


// like the news if the current user didn't before, dislike otherwise
router.put("/news/:newsId/like", function (req, res) {

    // if the user is not aunthenticated, return Unauthorized
    if (!req.isAuthenticated()) {
        return res.status(401).send();
    }
        
    // find the user
    User.findById(req.user._id, function (err, user) {
        if (err || !user) {
            return res.status(500).send();
        }

        // the index of the news to like in the user's likes list (if there isn't yet or the array is undefined it's -1)
        var likedNewsIndex = user.likedNews ? user.likedNews.findIndex( el => el.equals(req.params.newsId)) : -1;

        // find the news to like
        News.findById(req.params.newsId, function (err, news) {
            if (err || !news) {
                return res.status(500).send();
            }
            
            // the amount to like: 1 if we want to like (the news isn't in the list yet), -1 if we want to dislike (the user already liked the news)
            var likesCountChangeAmt = likedNewsIndex === -1 ? 1 : -1;

            // increase/decrease the like count and save the updated news
            news.likes = news.likes ? news.likes + likesCountChangeAmt : (likesCountChangeAmt > 0 ? 1 : 0);
            news.save();
            
            // add/remove the news id from the user's list and save the updated user
            if  (likesCountChangeAmt > 0){
                user.likedNews.push(req.params.newsId);
            } else {
                if (user.likedNews) {
                    user.likedNews.splice(likedNewsIndex, 1)
                }
            }
            user.save();

            res.send(likesCountChangeAmt.toString());
        })

    })
})


// respond for non-existing route
router.get("*", function(req, res){
    res.render("error", {error: "404"});
})


// FUNCTIONS

// generate and return a xml document from an array of news
function generateNewsXML(news){

    // the object to convert in xml
    var newsObj = {collection: {news: []}}
    
    // new news list where to add the interested info and the topics of news in a convertible form
    var newsList = [];

    // for every news, create a new news in newsList and add it the correct info
    for (let i = 0; i < news.length; i++) {
        var newNews = {}
        newNews.id = news[i]._id.toString();
        newNews.title = news[i].title;
        newNews.body = news[i].body;
        newNews.newspaper = news[i].newspaper;
        newNews.date = news[i].date;
        newNews.image = news[i].image;
        newNews.link = news[i].link;
        newNews.likes = news[i].likes ? news[i].likes : "0";
        newNews.topics = {topic: news[i].topics};
        newsList.push(newNews);
    }

    // add the filled list to newsObj
    newsObj.collection.news = newsList;

    // generate the xml code
    var xmlNewsList = xmlBuilder.create(newsObj).end({ pretty: true});

    return xmlNewsList;
}


module.exports = router;