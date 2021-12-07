var deployed = false;
var process_activeUserTask = false;
var process_activeServiceTask = false;
var activeTasksOld = new Array();
var activeUserTasksOld = new Array();
var serviceTasks = [];
var playVideo = "";
var userTaskId;
var processName;

var processId;
var deployed = false;
var processDefinitionId;

var PandaTaskName = [];

function setProcessId(id){
  this.processId = id;
}

function getProcessId(){
  return this.processId;
}

function setDeployed(value){
    this.deployed = value;
}

function getDeployed(){
    return this.deployed;
}

//var path = "http://ec2-34-245-179-201.eu-west-1.compute.amazonaws.com:8080/";
var path = "http://localhost:8080/"
//var path = "../../../../../";


function startProcess(){

    playVideo="";

  //set black stroke for all objects
  $("g > g > rect").css("stroke","black");

  $.ajax({
    type : "POST",
    url : path+"engine-rest/process-definition/"+getProcessId()+"/start",
    datatype : "application/json",
    contentType: "application/json",
    success : function(data) {

        //console.log("gdata");
        //console.log(data);
        setProcessDefinitionId(data.id);

        //process_active = true;
        process_activeServiceTask = true;
        process_activeUserTask = true;

        showToolbar(false);
        showPropertiesPanel(false);
        switchPlayPauseButton2(false);

        checkExecution();
        checkExecutionUserTasks();

    },
    error : function(error) {
     alert("error");
  }});
}


function deployProcess(){

console.log("deployed");

    if(!deployed){

        deleteExistingDeployments();

        setDeployed(true);

        $("#play_pause_button").attr("src", "../Panda-BPMN-Extension/img/pause.svg");

        var bpmn = $('#diagram').val();


        //console.log(bpmn);
        //add isExecutable to bpmn model
        var indexOfProcess = bpmn.indexOf("bpmn2:process");
        indexOfProcess = indexOfProcess + "bpmn2:process".length;
        var bpmnNew = bpmn.substring(0,indexOfProcess) + " isExecutable='true' " + bpmn.substring(indexOfProcess);
        bpmnNew = bpmnNew.replace('isExecutable="false"','');

        //add external + topic=pandaTaskExecution to all serviceTasks
        var regex = /<bpmn2:serviceTask/gi, result, indices = [];
        while ( (result = regex.exec(bpmnNew)) ) {
            indices.push(result.index + "<bpmn2:serviceTask".length + 1);
        }

        var bpmnFinal = "";
        var lastIndex = 0;
        indices.forEach ((item, index) => {
            bpmnFinal += bpmnNew.substring(lastIndex,item) + ' camunda:type="external" camunda:topic="pandaTaskExecution" ';
        lastIndex = item;
    });

        bpmnFinal += bpmnNew.substring(lastIndex);

        //add bpmn defintion
        var indexOfDefintions = bpmnFinal.indexOf("<bpmn2:definitions");
        indexOfDefintions = indexOfDefintions + "<bpmn2:definitions".length;

        if(bpmnFinal.indexOf(' xmlns:camunda="http://camunda.org/schema/1.0/bpmn" ') == -1){
            var bpmnFinal = bpmnFinal.substring(0,indexOfDefintions) + ' xmlns:camunda="http://camunda.org/schema/1.0/bpmn" ' + bpmnFinal.substring(indexOfDefintions);
        }

        //Add input Parameters
        var regex = /pandaTaskId/gi, result, indices = [];
        while ( (result = regex.exec(bpmnFinal)) ) {
            indices.push(result.index + "pandaTaskId=".length + 1 );
        }

        //console.log(bpmnFinal);

        var bpmnFinal2 = "";
        var lastIndex = 0;
        indices.forEach ((item, index) => {

            bpmnFinal2 += bpmnFinal.substring(lastIndex, item - "pandaTaskId=".length - 1);

        var part = bpmnFinal.substring(item);
        var indexOfClosingPandaTask = part.indexOf('"');
        var nameOfPandaTask = part.substring(0,indexOfClosingPandaTask);
        //console.log(nameOfPandaTask);
        var indexOfClosingBracket = part.indexOf(">")+1;

        bpmnFinal2 += '><bpmn2:extensionElements><camunda:inputOutput><camunda:inputParameter name="name">'+ nameOfPandaTask +'</camunda:inputParameter></camunda:inputOutput></bpmn2:extensionElements>';
        lastIndex = item + indexOfClosingBracket+1;

    });

        bpmnFinal2 += bpmnFinal.substring(lastIndex);
        //console.log(bpmnFinal2);

        //check if valid xml

        if(checkValidXML(bpmnFinal2)) {

            if (hasEachServiceTaskARobotTask(bpmnFinal2)) {

                // createServiceTaskList();

                const blobDiagram = new Blob([bpmnFinal2], {type: 'text/xml'});

                var random = new Date().getTime();
                var fd = new FormData();
                fd.append('deployment-name', "Assembly_" + random);
                fd.append('deployment-source', "Panda BPMN Modeler");
                fd.append('deploy-changed-only', "true");
                fd.append('test.bpmn', blobDiagram, 'test.bpmn');

                $.ajax({
                    type: "POST",
                    url: path + "engine-rest/deployment/create",
                    //  headers: {  'origin':'ec2-34-251-59-170.eu-west-1.compute.amazonaws.com:8080' },
                    //  crossDomain: true,
                    processData: false,
                    contentType: false,
                    data: fd,

                    success: function (data) {

                        setProcessId(Object.keys(data.deployedProcessDefinitions)[0]);
                        startProcess();

                    },
                    error: function (error) {
                        alert("Der Prozess konnte nicht gestartet werden. Bitte prüfen Sie ihr Programm sowie ihre Internetverbindung!");
                        $("#play_pause_button").attr("src", "../Panda-BPMN-Extension/img/play.svg");
                        setDeployed(false);

                    }
                });

            }
            else {
                alert("Nicht allen ServiceTasks ist ein Roboterbefehl zugeordnet!");
                $("#play_pause_button").attr("src", "../Panda-BPMN-Extension/img/play.svg");
                setDeployed(false);
            }

        }
        else{

            alert("Ihr Programm enthält keinen korrekten Prozess, bitte prüfen!");
            $("#play_pause_button").attr("src", "../Panda-BPMN-Extension/img/play.svg");
            setDeployed(false);

        }

    }
    else{
        //stop execution

        $.ajax({
            type : "DELETE",
            url : path+"engine-rest/process-instance/"+getProcessDefinitionId(),
            //  headers: {  'origin':'ec2-34-251-59-170.eu-west-1.compute.amazonaws.com:8080' },
            //  crossDomain: true,
            processData: false,
            contentType: false,

            success : function(data) {

                alert('Der Prozess wurde gestoppt!');
                $("#play_pause_button").attr("src", "../Panda-BPMN-Extension/img/play.svg");
                setDeployed(false);

            },
            error : function(error) {
                alert("Der Prozess konnte nicht gestoppt werden!");
            }});

    }

}

function deleteExistingDeployments(){

  $.ajax({
      type: "GET",
      url: path + "engine-rest/deployment",
      processData: false,
      contentType: false,

      success: function (data) {

            data.forEach(function(deployment){

                  var deploymentId = deployment.id
                  //try to delete deployments
                  $.ajax({
                      type : "DELETE",
                      url : path+"engine-rest/deployment/"+deploymentId+"?cascade=true",
                      //  headers: {  'origin':'ec2-34-251-59-170.eu-west-1.compute.amazonaws.com:8080' },
                      //  crossDomain: true,
                      processData: false,
                      contentType: false,

                      success : function(data) {

                          console.log("Deployment deleted: "+deploymentId);


                      },
                      error : function(error) {
                        console.log("Konnte existierendes Deployment "+deploymentId+" nicht löschen");
                        console.log(error);
                      }});

            });

      },
      error: function (error) {
          console.log("Konnte existierende Deployments nichts abrufen");
          console.log(error);
      }
  });


}

function checkExecution(){

  var count=0;
  var activeTasksNew = new Array();

  $.ajax({
    type : "GET",
    url : path+"engine-rest/external-task?processDefinitionId="+getProcessId(),
    datatype : "application/json",
    contentType: "application/json",
    success : function(data) {

            //console.log("d");
            //console.log(data);

              data.forEach(function(item){

                var nameOfTask = item.activityId;
                $("g[data-element-id='"+nameOfTask+"'] > g > rect").addClass("path");
                $("g[data-element-id='"+nameOfTask+"'] > g > rect").css("stroke","lightgreen");
                $("g[data-element-id='"+nameOfTask+"']").addClass("selected");

                activeTasksNew.push(nameOfTask);
                count++;

              });

              if(count==0){
                process_activeServiceTask = false;
              }
              else{
                process_activeServiceTask = true;
              }

             activeTasksOld.forEach(function(item){
                  if(!activeTasksNew.includes(item)){
                    $("g[data-element-id='"+item+"'] > g > rect").removeClass("path");
                    $("g[data-element-id='"+item+"'] > g > rect").css("stroke","black");
                     // document.getElementById('vid').stop();
                  }
             });

             //set activeTasksNew to Old
             //clear activeTasksNew
             activeTasksOld = [];
             activeTasksNew.forEach(function(item){
                activeTasksOld.push(item);
             });

    },
    error : function(error) {
    alert("error");
  }});

  //console.log("UserTask: "+process_activeUserTask);
  //console.log("ServiceTask: "+process_activeServiceTask);

  if(process_activeServiceTask){
      showFrankaIframe(true, process_activeServiceTask);
  }
  else{
      showFrankaIframe(false, "");
  }

  if(process_activeServiceTask || process_activeUserTask){
    setTimeout(checkExecution,500);
    setTimeout(checkExecutionUserTasks,500);
    setTimeout(hideGroup,0);
  }
  else{
    $(".path").css("stroke","black");
    $(".path").removeClass("path");

    $(".group").css("visibility","");
    showToolbar(true);
    showPropertiesPanel(true);
    switchPlayPauseButton2(true);
    setDeployed(false);
  }
}

function hideGroup(){
  $(".djs-context-pad").remove();
  $(".group").css("visibility","hidden");
}

function checkExecutionUserTasks(){

  var count=0;
  var activeUserTasksNew = new Array();

  $.ajax({
    type : "GET",
    url : path+"engine-rest/task?processDefinitionId="+getProcessId(),
    datatype : "application/json",
    contentType: "application/json",
    success : function(data) {

            data.forEach(function(item){

              var nameOfTask = item.taskDefinitionKey;

              $('#activeUserTask').val(nameOfTask);
              setWorkerAssExecution();

              $("g[data-element-id='"+nameOfTask+"'] > g > rect").addClass("path");
              $("g[data-element-id='"+nameOfTask+"'] > g > rect").css("stroke","lightgreen");
              $("g[data-element-id='"+nameOfTask+"']").addClass("selected");

              //add click event
              var endEventNode = document.querySelectorAll("[data-element-id='"+nameOfTask+"']");
              endEventNode.forEach(element => element.addEventListener('click', completeUserTask, true));
                endEventNode.forEach(element => element.addEventListener('touchstart', completeUserTask, true));

              //remove additional panel on click
              $(".djs-context-pad").remove();

              activeUserTasksNew.push(nameOfTask);

              userTaskId = item.id;

              count++;

          });

          if(count==0){
             process_activeUserTask = false;
               clearWorkerAss();
          }
          else{
            process_activeUserTask = true;
          }

          activeUserTasksOld.forEach(function(item){
            if(!activeUserTasksNew.includes(item)){
              $("g[data-element-id='"+item+"'] > g > rect").each(function(){
                $(this).removeClass("path");
              });

              $("g[data-element-id='"+item+"'] > g > rect").each(function(){
                $(this).css("stroke","black");
              });
            }
          });

          //set activeTasksNew to Old
          //clear activeTasksNew
          activeUserTasksOld = [];
          activeUserTasksNew.forEach(function(item){
            activeUserTasksOld.push(item);
          });
    },
    error : function(error) {
    alert("error");
  }});

}

function showToolbar(value){

  if(value == true){
    $(".djs-palette").css('visibility','');
    $("#play_pause_button").attr("src", "../Panda-BPMN-Extension/img/play.svg");

    //js-drop-zone height: 100%
    $("#js-drop-zone").css('height','90%');


  }
  else{
    $(".djs-palette").css('visibility','hidden');
    $("#play_pause_button").attr("src", "../Panda-BPMN-Extension/img/pause.svg");

    //js-drop-zone height: 60%
    $("#js-drop-zone").css('height','90%');

    document.getElementById('js-properties-panel2').style.width = '0px';
  }

}

function showPropertiesPanel(value){

  if(value == true){
    $("#js-properties-panel").css('visibility','');
  }
  else{
    $("#js-properties-panel").css('visibility','hidden');
  }

}

function switchPlayPauseButton2(value){

  if(value == true){
    $("#play_pause_button").attr("src", "../Panda-BPMN-Extension/img/play.svg");
  }
  else{
    $("#play_pause_button").attr("src", "../Panda-BPMN-Extension/img/pause.svg");
  }

}

function completeUserTask(){

  $.ajax({
    type : "POST",
    url : path+"engine-rest/task/"+userTaskId+"/complete",
    datatype : "application/json",
    contentType: "application/json",
    success : function(data) {
    },
    error : function(error) {
    }});

}

function convertString(string){

  string = string.toLowerCase();
  string = string.replace(/[^a-zA-Z0-9]/g,'_');

}

function showFrankaIframe(value, serviceTask){

  if(value == true){
    //show franka iframe
   // $("#franka_iframe").css('visibility','');
    //  $("#franka_iframe").toggle(true);
  //  alert(serviceTask);
  }
  else{
    //hide franka iframe
    //$("#franka_iframe").css('visibility','hidden');
    //  $("#franka_iframe").toggle(false);
  }

}


function setProcessDefinitionId(id){
    this.processDefinitionId = id;
}

function getProcessDefinitionId(){
    return this.processDefinitionId;
}


function hasEachServiceTaskARobotTask(bpmnDiagram){

    serviceTasks = [];

    var countServiceTasks = 0;
    var countRobotTask = 0;

    const regex = /:/gi;
    var newDiagram = bpmnDiagram.replace(regex,"");

    var $xml = $(jQuery.parseXML(newDiagram));

    var $test = $xml.find('bpmn2serviceTask').each(function(index, element){
        var $entry = $(this);
        var name = $entry.attr('id');
        //console.log(name);
        var val = $entry.find('camundainputOutput').text();

        if(val=="" || val==0){
            //no robot task
        }
        else{
            serviceTasks[name] = val;
            countRobotTask++;
        }
        countServiceTasks++;
    });

    if(countServiceTasks!=countRobotTask){
        return false;
    }
    else{
        return true;
    }

}

function checkValidXML(value){

    try{
        var $xml = $(jQuery.parseXML(value));
        return true;
    }
    catch(e){
        return false;
    }

}

deleteExistingDeployments();

$(document).ready(function(){
    $(this).scrollTop(0);
});
