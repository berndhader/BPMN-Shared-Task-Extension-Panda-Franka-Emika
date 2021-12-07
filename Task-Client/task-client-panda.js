const {
  Client,
  logger,
  Variables,
  File
} = require("camunda-external-task-client-js");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

//import settings
var settings = require("./settings.js");

console.log(settings.usernamePanda);
console.log(settings.passwordPanda);

// configuration for the Client:
//  - 'baseUrl': url to the Workflow Engine
//  - 'logger': utility to automatically log important events
const url = "http://localhost:8080/engine-rest";
const config = { baseUrl: url, use: logger };

// create a Client instance with custom configuration
const client = new Client(config);
// susbscribe to the topic: 'pandaTaskExecution'
client.subscribe("pandaTaskExecution", async function({ task, taskService }) {

    //encrypt password
    var crypto = require('crypto');
    var bs = settings.passwordPanda + '#' + settings.usernamePanda + "@franka";
    //hash with sha256
    var bsHash = crypto.createHash('sha256').update(bs).digest('hex');
    //split hash into groups of 2 and convert to int
    var chunks = [];
    for(var i = 0, charsLength = bsHash.length; i < charsLength; i+=2){
      var val = bsHash.substring(i, i+2);
      chunks.push(parseInt(val,16));
    }
    chunksString = chunks.toString();
    var encryptedBytes = Buffer.from(chunksString);
    var passwordEncrypted = encryptedBytes.toString('base64');
    console.log('password encrypted: ');
    console.log(passwordEncrypted);


    var Client = require('node-rest-client').Client;
    var client_getToken = new Client();
    client_getToken.parsers.remove("JSON");

    client_getToken.parsers.add({
               "name":"JSON",
               "isDefault": true,
                 "match":function(response){},
                 "parse":function(byteBuffer,nrcEventEmitter,parsedCallback){

              data = byteBuffer.toString();

            parsedCallback(data);

            },
                 // of course any other args or methods can be added to parser
                 "otherAttr":"my value",
                 "otherMethod":function(a,b,c){}
    });

    var args = {
          data: { login: settings.usernamePanda, password: passwordEncrypted },
          headers: { "Content-Type": "application/json"},
    };


    var panda = "https://192.168.0.1/admin/api/login";
    client_getToken.post(panda, args, function (data, response) {

          //login on the panda
          var pandaAuthenticationToken = data;
          var nameOfTask = task.variables.get("name");
          nameOfTask = convertString(nameOfTask);
          console.log(nameOfTask);

          var StateMachine = require('javascript-state-machine');
          var fsm = new StateMachine({
              init: 'open',
              transitions: [
                { name: 'start',     from: 'open',  to: 'running' },
                { name: 'end',   from: 'running', to: 'completed'  }
              ]
            });

          //send rest request to panda
          //Example POST method invocation
          var Client = require('node-rest-client').Client;
          var client = new Client();
          console.log("panda" + pandaAuthenticationToken);
          // set content-type header and data as json in args parameter
          var args = {
              data: { id: nameOfTask },
              headers: { "Content-Type": "application/x-www-form-urlencoded",
                         "Authorization": pandaAuthenticationToken
                       }
          };

          //start task
          var panda2 = "https://192.168.0.1/desk/api/execution";
          client.post(panda2, args, async function (data, response) {

                    fsm.start();

                    while(fsm.is("running")){

                        console.log(fsm.state);;
                        await new Promise((resolve, reject) => {
                            var Client = require('node-rest-client').Client;
                            var client_checkState = new Client();
                            var state;
                            var args = {
                                headers: { "Authorization": pandaAuthenticationToken }
                            };

                            //check status of task execution
                            var panda3 = "https://192.168.0.1/desk/api/execution";
                            client_checkState.get(panda3, args, function (data, response) {
                                data = data.toString('utf8');
                                var json_obj = JSON.parse(data);
                                state = json_obj.state.active;
                                resolve(state);
                            });

                        }).then(state => {
                            console.log("state is "+state);
                            if(state === false){
                                fsm.end();
                                taskService.complete(task);
                            }
                        }).catch(err => {
                            console.error(err);
                        });

                        await new Promise((resolve,reject) => { setTimeout(() => resolve(), 500)});

                    }

              });
        });
});


function convertString(string){

    string = string.toLowerCase();
    string = string.replace(/[^a-zA-Z0-9]/g,'_');
    return string;

}
