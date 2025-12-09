const workManageModel = require("../model/workManageModel");

module.exports = {
  updateWorkflowData: function (req, res) {
    let data = JSON.parse(req.query[0]);
    workManageModel.updateWorkflowData(data, (rows) => {
      res.send(JSON.stringify(rows));
    });
  },
};
