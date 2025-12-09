const config = require("../config/baseconfig");
const reportModel = require("../model/reportModel");
const fs = require("fs");

module.exports = {
  getReportSummary: function (req, res) {
    let data = JSON.parse(req.params.data);
    reportModel.getSummary(data, (rows) => {
      res.send(JSON.stringify(rows));
    });
  },

  getReportTrendSummary: function (req, res) {
    let data = JSON.parse(req.params.data);
    reportModel.getTrendSummary(data, (rows) => {
      res.send(JSON.stringify(rows));
    });
  },

  getReportTrendSummaryComplete: function (req, res) {
    let data = JSON.parse(req.params.data);
    reportModel.getTrendSummaryComplete(data, (rows) => {
      res.send(JSON.stringify(rows));
    });
  },

  get1YearIssue: function (req, res) {
    let data = JSON.parse(req.params.data);
    reportModel.get1YearIssue(data, (rows) => {
      res.send(JSON.stringify(rows));
    });
  },

  get90DaysOverIssue: function (req, res) {
    let data = JSON.parse(req.params.data);
    reportModel.get90DaysOverIssue(data, (rows) => {
      res.send(JSON.stringify(rows));
    });
  },

  getAverageTime: function (req, res) {
    let data = JSON.parse(req.params.data);
    reportModel.getAverageTime(data, (rows) => {
      res.send(JSON.stringify(rows));
    });
  },
};
