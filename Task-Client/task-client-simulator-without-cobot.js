//This node application simulates the task execution of the cobot (in a very simple way)
//and can be used to test the BPMN prototoype without a cobot.
//Open BPMN ServiceTasks subscribed to the topic "pandaTaskExecution" are fetched.
//After wating for 5 seconds -> the task is set to completed.

const {
  Client,
  logger,
  Variables,
  File
} = require("camunda-external-task-client-js");

// configuration for the Client:
//  - 'baseUrl': url to the Workflow Engine
//  - 'logger': utility to automatically log important events
const url = "http://localhost:8080/engine-rest";
const config = { baseUrl: url, use: logger };

// create a Client instance with custom configuration
const client = new Client(config);

// susbscribe to the topic: 'pandaTaskExecution'
client.subscribe("pandaTaskExecution", async function({ task, taskService }) {

  var nameOfTask = task.variables.get("name");
  console.log(nameOfTask);

  var StateMachine = require('javascript-state-machine');
  var fsm = new StateMachine({
      init: 'open',
      transitions: [
        { name: 'start',     from: 'open',  to: 'running' },
        { name: 'end',   from: 'running', to: 'completed'  }
      ]
    });

    fsm.start();

    var count = 0;
    //wait 5 seconds
    while(count < 5){
      await new Promise(resolve => setTimeout(resolve, 1000));
      count++;
    }

    //set task to completed
    console.log("end task " + nameOfTask);
    await taskService.complete(task);

});
