var express = require('express'),
    http = require('http'),
    app = express(),
    bodyParser = require('body-parser'),
    redis = require('redis');

//app.use(express.bodyParser());
app.use('/client',  express.static(__dirname + '/client'));
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));  

redisClient = redis.createClient();
redisClient.on('connect', function() {
    console.log('redis is connected');
});

// create HTTP server/
http.createServer(app).listen(3000);

app.post("/topUrl",function(req,res){
	redisClient.keys('shortUrl:*',function(err, keys){
		keys.shift();
		keys.unshift('allUrl',keys.length);
		//console.log("keys:"+keys);
		redisClient.zunionstore.apply(redisClient, keys);
		
		redisClient.zrevrange('allUrl',0,9, function(err, replies) {
			//console.log("zrevrange  replies:"+replies);
			res.json(JSON.stringify(replies));
		});	
	});
});
//routes
app.get("/", function (req, res) {
    res.sendFile('client/index.html', {root: __dirname });
});
app.get("/:shortUrl",function(req,res){
	console.log("shortUrl:"+req.params.shortUrl);
	redisClient.zrange("shortUrl:"+req.params.shortUrl, 0,-1, function(err,result) {
		console.log(' zrange err:'+err);
		console.log(' zrange result:'+result);
		if(result){
			redisClient.zincrby("longUrl:"+result,1,req.params.shortUrl);
	    	redisClient.zincrby("shortUrl:"+req.params.shortUrl,1,result);
			res.redirect('http://'+result);
		}
	});
	  
});
app.post("/originalURL", function(req,res){
	console.log("shortUrl::"+req.body.shortUrl);
	redisClient.zrange("shortUrl:"+req.body.shortUrl, 0,-1, function(err,result) {
		console.log(' zrange err:'+err);
		console.log(' zrange result:'+result);
		if(result){
			var urlPair ={};
			urlPair.shorten=req.body.shortUrl;
			urlPair.url=result;
			console.log("urlPair:"+JSON.stringify(urlPair));
			res.json(JSON.stringify(urlPair));
		}
	});
});
app.post("/urlShortener", function (req, res) {
  console.log("url:"+req.body.url);
  var MIN_URL_TO_SHORTEN=20;
  var urlPair ={};
  if(req.body.url.length <= MIN_URL_TO_SHORTEN){
  	res.json(JSON.stringify(urlPair));
  	return;
  }
  redisClient.exists("longUrl:"+req.body.url, function(err, exists) {
		if(err) {
	        console.log('ERROR: '+error);
	    } else if(exists) {
	    	console.log('url exists');
	    	redisClient.zrange("longUrl:"+req.body.url, 0,-1, function(err,result) {
	    		console.log(' zrange err:'+err);
	    		console.log(' zrange result:'+result);
	    		if(result){
	    			shortUrl = result;
	    			urlPair.url=req.body.url;
					urlPair.shorten=result;
					console.log("44 shortUrl:"+result);
					console.log("urlPair:"+JSON.stringify(urlPair));
					res.json(JSON.stringify(urlPair));
	    		}
	    	});

	    }else{
	    	console.log('url not exists');
	        redisClient.exists('sequence', function(error, exists) {
			    if(error) {
			        console.log('ERROR: '+error);
			    } else if(!exists) {
			    	console.log('intial sequence with 1000000');
			        redisClient.set('sequence', 1000000); //create the url sequence
			    }
			    redisClient.incr("sequence");
		        redisClient.get('sequence', function (err, sequence) {
			        console.log("get sequence:"+sequence);
			        console.log("get sequence in 36:"+parseInt(sequence).toString(36));
					shortUrl = parseInt(sequence).toString(36);
					console.log("shortUrl:"+shortUrl);
					redisClient.zadd("longUrl:"+req.body.url,1,shortUrl);
					redisClient.zadd("shortUrl:"+shortUrl,1,req.body.url);

					urlPair.url=req.body.url;
					urlPair.shorten=shortUrl;
					console.log("70 shortUrl:"+shortUrl);
					console.log("urlPair:"+JSON.stringify(urlPair));
					res.json(JSON.stringify(urlPair));
				});
			});
				
	    }
			    
	}); //exists
  //(128482).toString(36);
  //parseInt("2r4y", 36);
  
});

console.log("server listening on port 3000");
