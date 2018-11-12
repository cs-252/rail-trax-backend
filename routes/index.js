// let config = require("./config/config");
let express = require('express');
var router = express.Router();
var admin = require('firebase-admin');
var DEVELOP = true ;
router.post('/setup-session', (req, res, next) => {
  // res.send('hello');
  //res.send(req.body.index);
  //console.log(req.body);
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
            .then(function(){ res.status(200).send({message:"Success"});
        })
            .catch(function(err){ console.log(err);
                res.status(500).send({message:"Fail"});
                                    });
      //res.status(200).send("Fine");
  }


});

router.post('/end-session', (req, res, next) => {
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
                {
                    prevcoins=0;
                }
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
                .catch(function(){
                    res.status(500).send({message:"Internal error"})
                })
            });


        }
        console.log("session must end");
    });

});

router.post('/location-info', (req, res, next) => {
    //res.status(200).send();
    console.log(req.body.geoData);
    let db = admin.firestore();
    let traindata = db.doc('trains/'+req.body.pnrData.train).get();
    let currstmp=new Date().getTime();
    traindata.then(function(datt){
        let feeders = datt.data().feeders;
        //feeders.push({uid:req.body.uid,geoData:req.body.geoData,timestamp:currstmp})
        for(let i=0;i<feeders.length();i++)
        {
            if((feeders[i].timestmp-currstmp)/(10*60*1000) > 1)
            {

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
                        coins=coins -10;
                        let usracc = db.doc('users/'+req.body.uid).get();
                        console.log("lets update the coins");
                        usracc.then(function(ddat){
                            let prevcoins=ddat.data().coins;
                            if(!prevcoins)
                            {
                                prevcoins=0;
                            }
                            coins=coins+prevcoins;
                            if(DEVELOP)
                            {
                                coins=100;
                                prevcoins=0;
                            }
                            db.doc('users/'+req.body.uid).update({coins:coins})
                            .then(function(){
                                db.doc('sessions/'+req.body.uid).delete()
                                .then(function(){res.status(200).send({message:"Session ended",earnings:(coins-prevcoins)})
                            })
                            })
                            .catch(function(){
                                res.status(500).send({message:"Internal error"})
                            })
                        });


                    }
                    });
                    let removed=feeders.splice(i,1);
            }

            if(feeders[i].uid==req.body.uid && req.body.packet_no>feeders[i].packet_no)
            {
                feeders[i].geoData=req.body.geoData;
            }

            if(feeders[i].uid!=req.body.uid && i==feeders.length()-1)
            {
                feeders.push({uid:req.body.uid,geoData:req.body.geoData,timestamp:currstmp,packet_no:req.body.packet_no});
            }
        }

        let geolocation={latitude:0,longitude:0,accuracy:0};
        for(let i=0;i<feeders.length();i++)
        {
            geolocation.latitude=feeders[i].latitude+geolocation.latitude;
            geolocation.longitude=feeders[i].longitude+geolocation.longitude;
            geolocation.accuracy=feeders[i].accuracy+geolocation.accuracy;
        }
        geolocation.latitude=geolocation.latitude/feeders.length();
        geolocation.longitude=geolocation.longitude/feeders.length();
        geolocation.accuracy=geolocation.accuracy/feeders.length();
        db.doc('trains/'+req.body.pnrData.train).update({location:geolocation,feeders:feeders});
    });
});


module.exports = router;
