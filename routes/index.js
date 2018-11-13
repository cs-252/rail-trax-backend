// let config = require("./config/config");
let express = require('express');
var router = express.Router();
var admin = require('firebase-admin');
var DEVELOP = true ;
router.post('/setup-session', (req, res) => {
  let currstmp=new Date().getTime();
  let usrstmp = new Date(req.body.pnrData.doj).getTime();
  console.log((usrstmp-currstmp)/(86400000));
  if( usrstmp+(4*86400*1000) <currstmp || usrstmp>currstmp)
  {
      console.log("error 403");
      res.status(403).send(JSON.stringify({status:"doj invalid"}));
  }
  else {
      let db = admin.firestore();
      let usrdata = db.doc('sessions/'+req.body.uid);
      usrdata.set({uid:req.body.uid, startTime:currstmp, pnrData:req.body.pnrData})
        .then(() => { res.status(200).send({message:"Success"})})
        .catch(err => {
            console.log(err);
            res.status(500).send({message:"Fail"});
        });
    }
});

router.post('/end-session', (req, res, next) => {
    console.log(req.body);
    let db = admin.firestore();
    let currstmp=new Date().getTime();
    console.log("ending session");
    let usrdata = db.doc('sessions/'+req.body.uid).get();
    console.log("got the user data");
    usrdata.then(function(doc){
        if(!doc.exists)
        {
            res.status(400).send({message:"session does not exist"});
            return ;
        }
        else {
            let startstmp=doc.data().startTime;
            let coins=10*(Math.floor((currstmp-startstmp)/(10*60*1000)));
            let usracc = db.doc('users/'+req.body.uid).get();
            console.log("lets update the coins");
            usracc.then(function(ddat){
                let prevcoins=ddat.data().coins;
                if(!prevcoins)
                    prevcoins=0;
                coins=coins+prevcoins;
                if(DEVELOP)
                {
                    coins=100;
                    prevcoins=0;
                }
                db.doc('users/'+req.body.uid).update({coins:coins})
                .then(function(){ console.log("updated coins"); })
                .then(function(){
                    db.doc('sessions/'+req.body.uid).delete()
                    .then(function(){res.status(200).send({message:"Session ended",earnings:(coins-prevcoins)})
                })
                })
                .catch(function(err){
                    console.error(err);
                    res.status(500).send({message:"Internal error"})
                });
            }).then(() => {
                let sHist = req.body.userData.sessionHistory;
                if(!sHist) sHist = [];
                sHist.push({
                    earnings: DEVELOP?100:coins,
                    startTime: startstmp,
                    endTime: currstmp,
                    train: req.body.pnrData.train.name+' ('+req.body.pnrData.train.number+')'
                });
                db.doc('users/'+req.body.uid).update({sessionHistory: sHist})
            });
        }
        console.log("session must end");
    });

});

router.post('/location-info', (req, res, next) => {
    let db = admin.firestore();
    console.log(req.body.sessionData.pnrData.train.number);
    // return;
    let traindata = db.doc('trains/train'+req.body.sessionData.pnrData.train.number).get();
    let currstmp=new Date().getTime();
    traindata.then(function(datt){
        console.log('Got train data, now looking through feeders');
        let feeders = datt.data().feeders;
        //feeders.push({uid:req.body.uid,geoData:req.body.geoData,timestamp:currstmp})
        for(let i=0;i<feeders.length;i++)
        {
            if((-feeders[i].timestmp+currstmp)/(10*60*1000) > 1)
            {
                console.log('Stray feeder found. End his session');
                let usrdata = db.doc('sessions/'+req.body.sessionData.uid).get();
                console.log("got the user data");
                usrdata.then(function(doc){
                    if(!doc.exists)
                    {
                        res.status(400).send({message:"session does not exist"});
                        return ;
                    }
                    else {
                        let startstmp=doc.data().startTime;
                        let coins=10*(Math.floor((currstmp-startstmp)/(10*60*1000)));
                        coins=coins -10;
                        let usracc = db.doc('users/'+req.body.sessionData.uid).get();
                        console.log("lets update the coins");
                        usracc.then(function(ddat){
                            let prevcoins=ddat.data().coins;
                            if(!prevcoins) prevcoins=0;
                            coins=coins+prevcoins;
                            if(DEVELOP)
                            {
                                coins=100;
                                prevcoins=0;
                            }
                            db.doc('users/'+req.body.sessionData.uid).update({coins:coins})
                              .then(() => {
                                db.doc('sessions/'+req.body.sessionData.uid).delete()
                                .then(() => {
                                    res.status(200).send({message:"Session ended",earnings:(coins-prevcoins)});
                                });
                            })
                            .catch(function(err){
                                res.status(500).send({message:"Internal error"});
                                console.error(err);
                            })
                        });
                    }
                });
            }
            if(feeders[i].uid==req.body.sessionData.uid)
                feeders[i].geoData=req.body.geoData;
        }
        var found = false;
        for(let i = 0; i < feeders.length; i++) {
            if (feeders[i].uid === req.body.sessionData.uid) {
                found = true;
                break;
            }
        }
        if(!found)
            feeders.push({uid:req.body.sessionData.uid,geoData:req.body.geoData,timestamp:currstmp});

        let geolocation={latitude:0,longitude:0,accuracy:0};
        for(let i=0;i<feeders.length;i++)
        {
            geolocation.latitude += feeders[i].geoData.latitude;
            geolocation.longitude += feeders[i].geoData.longitude;
            geolocation.accuracy += feeders[i].geoData.accuracy;
        }
        geolocation.latitude=geolocation.latitude/feeders.length;
        geolocation.longitude=geolocation.longitude/feeders.length;
        geolocation.accuracy=geolocation.accuracy/feeders.length;
        console.log('Updating geo location', geolocation, feeders);
        db.doc('trains/train'+req.body.sessionData.pnrData.train.number)
            .update({location:geolocation,feeders:feeders})
            .then(() => {
                res.status(200).send({message: 'pushed'});
            });
    });
});


module.exports = router;
