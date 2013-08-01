/***************************************************************************
 * A/B Testing Workflow Activity
 * 
 * 
 * 
 * Supported databases: PostgreSQL, Oracle
 **************************************************************************/
loadLibrary("psns:core.js");

psns.abtesting  = psns.abtesting || (function() {

  var methods = {
    "estimatedRecipientOpenRatio":  { desc: "Open rate", format: "percent", keep: "max" },
    "recipientClickRatio":          { desc: "Click rate", format: "percent", keep: "max" },
    "reactivity":                   { desc: "Reactivity", format: "percent", keep: "max" },
    "refusedRatio":                 { desc: "User complains", format: "percent", keep: "min" },
    "transactionRatio":             { desc: "Conversion rate", format: "percent", keep: "max" },
    "totalWebPage":                 { desc: "Web traffic", format: "value", keep: "max" },
    "optOutRatio":                  { desc: "Opt-out rate", format: "percent", keep: "min" },
    "amount":                       { desc: "Revenues", format: "value", keep: "max" }
  }
  
  var formatOptions = {
    "value":   { decimals: 0 },
    "percent": { decimals: 2, suffix: "%" }
  }
  
  var STATUS = { NOT_STARTED: 0, TESTING: 1, FINISHED: 2 };

  var workflow = workflow || xtk.workflow.load(instance.id).toXML();

  return {
  
    activityXml: function() {
      return workflow.activities.abtesting.(@name == activity.name);
    },
    
    /** Current status of the test.
      * 
      * @return NOT_STARTED, TESTING or FINISHED */
    status: function() {
      return instance.vars[activity.name + "_status"];
    },
    
    /** Name of the working table of the population on hold
      *
      * @return the tableName of the population on hold */
    targetOnHold: function() {
      return instance.vars["tableName_" + activity.name];
    },

    /** Set the tablename of the population on hold */
    holdTarget: function(tableName) {
      instance.vars["tableName_" + activity.name] = tableName;
    },

    /** Get the test expiration date */
    expirationDate: function() {
      return instance.vars["expiration_" + activity.name];
    },

    /** Set the test expiration date */
    setExpirationDate: function(date) {
      instance.vars["expiration_" + activity.name] = date;
    },

    /** Check if the A/B transitions are going to a recurring delivery activity.
      */
    checkTransitions: function() {
    
      var errors = 0;
      var xmlActivity = this.activityXml();
      
      for each (var abtest in xmlActivity.transitions.abtest) {
      
        var target = String(abtest.@target);
        if ( target != "" && workflow.activities.deliveryRecurring.(@name == target).length() != 1 ) {
          logWarning("The target of the transition '" + abtest.@label + "' must be a recurring delivery");
          errors++;
        }
      
      }
      
      if ( errors > 0 ) {
        logError("Invalid configuration for the activity '" + activity.label + "'");
      }
    
    },

    /** Execute the A/B test
      *
      * @return the complement table name and the number of records in it. */    
    test: function() {
    
      activity.status = STATUS.NOT_STARTED;
      instance.vars[activity.name + "_status"]  = STATUS.NOT_STARTED;
    
      // reset all variables if necessar
      activity.winningVersion.version           = "";
      activity.winningVersion.transition        = "";
      activity.winningVersion.score             = "";
    
      var inboundTableName = vars.tableName;
      
      var testGroupSize;
      if ( activity.testGroupSize === "percent" ) {
        // count the number of record in the inbound table
        var total = parseInt(xtk.queryDef.create(<queryDef schema={vars.targetSchema} operation="count"/>).ExecuteQuery().@count, 10);
        testGroupSize = Math.ceil(total * (activity.testPercent/100));
      }
      else {
        testGroupSize = activity.testLimit;
      }
      
      var tableIndex = 1;
      var xmlActivity = this.activityXml();
      for each (var abtest in xmlActivity.transitions.abtest) {
      
        var subsetTableName = "wkf" + Math.abs(instance.id) + "_" + task.taskIdentifier + "_" + tableIndex++;
        
        logInfo("Preparing test target for '" + abtest.@label + "' " + subsetTableName + " (" + vars.targetSchema + ")");
        
        var xtkQuery = xtk.queryDef.create(
          <queryDef schema={vars.targetSchema} operation="select" lineCount={testGroupSize}>
            <orderBy>
              <node expr="random()"/>
            </orderBy>
          </queryDef>);
          
        xtkQuery.SelectAll(false);
        var xmlQuery = xtkQuery.toXML();
        
        var sql = "INSERT INTO " + subsetTableName + " (" 
          + buildColumnList(vars.targetSchema, xmlQuery.select)
          + ") " + xtkQuery.BuildQuery();

        setSchemaSqlTable(vars.targetSchema, subsetTableName);
        buildSqlTable(vars.targetSchema);
        
        var inserts = sqlExec(sql);
        
        vars.tableName    = subsetTableName;
        vars.description  = inserts;
        task.postEvent(task.transitionByName(abtest.@name));
        
        // restore the original name of the inbound table
        setSchemaSqlTable(vars.targetSchema, inboundTableName);
        
        // 
        // build the complement table
        // 
        var complementTableName = "wkf" + Math.abs(instance.id) + "_" + task.taskIdentifier + "_" + tableIndex++;
        
        var targetSchema = Application.getSchema(vars.targetSchema);
        var exclJoin = new Array();
        var exclCond = new Array();
        for each (var key in targetSchema.root.keys) {
          for each (var field in key.fields) {
            exclJoin.push("W0." + field.SQLName + "=Excl." + field.SQLName);
            exclCond.push("Excl." + field.SQLName + " IS NULL");
          }
        }

        var xtkQuery = xtk.queryDef.create(<queryDef schema={vars.targetSchema} operation="select" noLineCount="1"/>);
          
        xtkQuery.SelectAll(false);
        var xmlQuery = xtkQuery.toXML();
        
        var sql = "INSERT INTO " + complementTableName + " (" 
          + buildColumnList(vars.targetSchema, xmlQuery.select)
          + ") " + xtkQuery.BuildQuery() 
          + " LEFT JOIN " + subsetTableName + " Excl ON (" + exclJoin.join(" AND ") + ")"
          + " WHERE " + exclCond.join(" AND ");
          
        setSchemaSqlTable(vars.targetSchema, complementTableName);
        buildSqlTable(vars.targetSchema);
          
        inserts = sqlExec(sql);
        
        inboundTableName = complementTableName;
      }

      activity.status = STATUS.TESTING;
      instance.vars[activity.name + "_status"]  = STATUS.TESTING;
      return { tableName: complementTableName, recCount: inserts };
      
    },

    /** Compare the result of the tests and returns the winner.
      * 
      * return the name of the transition to the winner. */
    compare: function() {
    
      var method      = methods[activity.method];
      var winner      = undefined;
      var deliveries  = [];
      var errors      = 0;
      var xmlActivity = this.activityXml();
      
      for (var i=0; i < activity.transitions.abtest.length; i++) {
        
        var abtest = activity.transitions.abtest[i];
        var target = workflow.activities.deliveryRecurring.(@name == abtest.target);
        var delivery = { 
          templateId: parseInt(target.@["delivery-id"], 10),
          transition: abtest.name,
          version:    abtest.label
        }
        
        // check if we can find a suitable test delivery
        var testDelivery = xtk.queryDef.create(
          <queryDef schema="nms:delivery" operation="getIfExists">
            <select>
              <node expr="@id"/>
              <node expr="@state"/>
              <node expr="[.]" alias="@_cs"/>
              <node expr={"[indicators/@" + activity.method + "]"} alias="/@indicator"/>
            </select>
            <where>
              <condition expr="[@FCP] = false"/>
              <condition expr={"[@recurringDelivery-id] = " + delivery.templateId}/>
            </where>
            <orderBy>
              <node expr="[@id]" sortDesc="true"/>
            </orderBy>
          </queryDef>).ExecuteQuery();
          
        if ( testDelivery.@id == undefined ) {
          logWarning("Unable to find a suitable test delivery for the test '" + abtest.label + "'");        
          errors++;
        }
        else if ( parseInt(testDelivery.@state, 10) <= 51 /* Start Pending */ ) {
          logWarning("The test delivery '" + testDelivery.@_cs + "' for the test group '" + abtest.label + "' is not in a valid state");
          errors++;
        }
        else {
          delivery.id        = parseInt(testDelivery.@id, 10);
          delivery.indicator = parseFloat(testDelivery.@indicator);
          delivery.score     = psns.number.format(delivery.indicator * (method.format === "percent" ? 100 : 1), formatOptions[method.format]);
          
          if ( delivery.indicator === 0 ) {
            logWarning("No results available for the test delivery '" + testDelivery.@_cs + "' for the test group '" + abtest.label + "'");
            errors++
          }
          else if ( winner === undefined 
            || ( method.keep === "max" && delivery.indicator > winner.indicator ) 
            || ( method.keep === "min" && delivery.indicator < winner.indicator ) ) {
            winner = delivery;
          }
          
          deliveries.push(delivery);
        }
      }
      
      if ( errors > 0 ) {
        logError("A/B test comparison failed");
        return 0;
      }
      
      activity.status = 2; /* Finished */
      activity.winningVersion.version     = winner.version;
      activity.winningVersion.transition  = winner.transition;
      activity.winningVersion.score       = winner.score;
      
      instance.vars[activity.name + "_status"] = STATUS.FINISHED;
      
      // builld the others score variable
      var othersScore = [];
      for (var i=0; i < deliveries.length; i++) {
        if ( deliveries[i].transition != winner.transition ) {
          othersScore.push(deliveries[i].version + " (" + deliveries[i].score + ")");
        }
      }
      
      activity.winningVersion.othersScore = othersScore.join(", ");
      return 0;
    },
  
    call: function() {
 
      // check if the target of the test transitions are recurring deliveries   
      this.checkTransitions();

      if ( this.status() === STATUS.FINISHED ) {
        // this is not the fist exectution of this activity, we've already performed 
        // the a/b test and have a winner
        return this.recall();
      }
      else if ( this.status() === STATUS.TESTING ) {
        //
        // a new population is reaching this activity but the test is still in progress
        // 
        if ( activity.transitions.abcomplement.enabled === true ) {
          // no hold of the inbound population during the test, so we pass the inbound
          // population to the complement transition.
          vars.description  = vars.recCount;
          task.postEvent(task.transitionByName(activity.transitions.abcomplement.name));
          task.setCompleted();
        }
        else {
          // we need to hold the inbound population until the end of the test
          // => merge it with the population already in hold
          var targetOnHold  = this.targetOnHold();
          var targetMerged  = "wkf" + Math.abs(instance.id) + "_" + task.taskIdentifier;
          
          var cnx = application.getConnection();
          if ( cnx.isPostgreSQL ) {
            cnx.execute(<sql>SELECT * INTO {targetMerged} FROM {targetOnHold} UNION ALL SELECT * FROM {vars.tableName}</sql>);
          }
          else if ( cnx.isPostgreSQL ) {
            cnx.execute(<sql>CREATE TABLE {targetMerged} AS SELECT * FROM {targetOnHold} UNION ALL SELECT * FROM {vars.tableName}</sql>);
          }
          else {
            logError("Database engine not supported");
          }

          cnx.dispose();
          this.holdTarget(targetMerged);
          logInfo("Test in progress, the new inbound population has been merged with the population already on hold");
        }
        
        return 0;
      }

      var complement = this.test();
      
      if ( activity.transitions.abcomplement.enabled === true ) {
        // 
        // post an event on the complement transition
        // 
        vars.tableName    = complement.tableName;
        vars.recCount     = parseInt(xtk.queryDef.create(<queryDef schema={vars.targetSchema} operation="count"/>).ExecuteQuery().@count, 10);
        vars.description  = complement.recCount;
        task.postEvent(task.transitionByName(activity.transitions.abcomplement.name));
      }
      else {
        // 
        // hold the complement until the result of the A/B test
        // 
        this.holdTarget(complement.tableName);
      }      
      
      // schedule the execution of the next step (=> identification of the winner).
      var nextProcessingDate = getCurrentDate();
      nextProcessingDate.setTime(nextProcessingDate.getTime() + activity.duration * 1000);
      this.setExpirationDate(nextProcessingDate);
      task.setNextProcessingDate(nextProcessingDate);
      return 0;
    },
    
    recall: function() {
    
      if ( this.status() === STATUS.TESTING ) {
      
        if ( this.expirationDate() > getCurrentDate() ) {
          return 0;
        }
        
        // compare the test groups and find the winning versions
        this.compare();
        if ( activity.transitions.abcomplement.enabled === true ) {
          // after the preparation of the test, the activity did not hold
          // the complement population => nothing to do
          task.setCompleted();
          return 0;
        }
      }
      
      if ( this.status() !== STATUS.FINISHED ) {
        logError("Invalid state");
      }
      
      var targetOnHold = this.targetOnHold();
      if ( targetOnHold != "" ) {
        // there is a target on hold
        // => release the target
        vars.tableName = targetOnHold;
        setSchemaSqlTable(vars.targetSchema, vars.tableName);
        vars.recCount = parseInt(xtk.queryDef.create(<queryDef schema={vars.targetSchema} operation="count"/>).ExecuteQuery().@count, 10);
        this.holdTarget("");  // no longer hold this table
      }
      
      vars.description = vars.recCount;
      task.postEvent(task.transitionByName(activity.winningVersion.transition));
      task.setCompleted();
      return 0;
    }
    
  }

})();

function abtesting_call() {
  return psns.abtesting.call();
}

function abtesting_recall() {
  return psns.abtesting.recall();
}