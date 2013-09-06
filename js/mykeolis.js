(function(w) {
  'use strict';
  var angular = w.angular;

  var myKeolis = angular.module('myKeolis', ['ngAnimate', 'ngRoute', 'FirefoxOS', 'localStorage', 'ngTouch']);

  myKeolis.config([
    '$routeProvider',
    function($routeProvider) {

      $routeProvider.when('/', {
        templateUrl: 'home.html',
        controller: 'HomeCtrl'
      });

      $routeProvider.when('/new', {
        templateUrl: 'new-item.html',
        controller: 'NewItemCtrl'
      });

      $routeProvider.html5Mode = false;

      $routeProvider.otherwise({redirectTo: '/'});

    }
  ]);

  myKeolis.run(['KService', function(KService) {
    KService
      .setKeolisEndpoint('http://timeo3.keolis.com/relais/')
      .setCityCode(217);
  }]);

  myKeolis.factory('KService', [
    '$http', '$q', 'systemXHR',
    function($http, $q, systemXHR) {

      var KService = {};

      var cityCode;
      var endpoint;

      KService.setKeolisEndpoint = function(url) {
        endpoint = url;
        return KService;
      };

      KService.setCityCode = function(code) {
        cityCode = code;
        return KService;
      };

      KService.getSchedulesServiceURL = function(refsArret) {
       return endpoint + cityCode + '.php?xml=3&ran=1&refs='+refsArret;
      };

      KService.getLinesServiceURL = function() {
       return endpoint + cityCode + '.php?xml=1';
      };

      KService.getStopsServiceURL = function(codeLigne, sens) {
       return endpoint + cityCode + '.php?xml=1&ligne='+codeLigne+'&sens='+sens;
      };

      function transformXPathResult(xPathResult, transform) {
        var nodes = [];
        var current;
        while((current = xPathResult.iterateNext())) {
          nodes.push(transform(current));
        }
        return nodes;
      }

      function toObject(node) {
        var obj = {};
        var len = node.children.length;
        var child;
        while(len--) {
          child = node.children[len];
          obj[child.nodeName] = child.textContent;
        }
        return obj;
      }

      function toStopObject(node) {
        var obj = toObject(node.children[0]);
        obj.refs = node.children[2].textContent;
        return obj;
      }

      KService.getLinesList = function() {
        var deferred = $q.defer();
        var url = KService.getLinesServiceURL();
        systemXHR(url)
          .then(function(xhr) {
            var xml = new DOMParser().parseFromString(xhr.responseText, 'text/xml');
            var xPathResult = xml.evaluate('//alss/als/ligne', xml, null, XPathResult.ANY_TYPE, null);
            var lines = transformXPathResult(xPathResult, toObject);
            return deferred.resolve(lines);
          });
        return deferred.promise;
      };

      KService.getStopsList = function(codeLigne, sens) {
        var deferred = $q.defer();
        var url = KService.getStopsServiceURL(codeLigne, sens);
        systemXHR(url)
          .then(function(xhr) {
            var xml = new DOMParser().parseFromString(xhr.responseText, 'text/xml');
            var xPathResult = xml.evaluate('//alss/als', xml, null, XPathResult.ANY_TYPE, null);
            var stops = transformXPathResult(xPathResult, toStopObject);
            return deferred.resolve(stops);
          });
        return deferred.promise;
      };

      KService.getSchedulesList = function(refsArret) {
        var deferred = $q.defer();
        var url = KService.getSchedulesServiceURL(refsArret);
        systemXHR(url, {'responseType': 'xml'})
          .then(function(xhr) {
            var xml = new DOMParser().parseFromString(xhr.responseText, 'text/xml');
            var xPathResult = xml.evaluate('//horaires/horaire/passages/passage', xml, null, XPathResult.ANY_TYPE, null);
            var schedules = transformXPathResult(xPathResult, toObject);
            return deferred.resolve(schedules);
          });
        return deferred.promise;
      };

      return KService;
    }
  ]);

  myKeolis.controller('NavBarCtrl', [
    '$scope', '$location',
    function($scope, $location) {

      $scope.$location = $location;

      $scope.$watch('$location.path()', function(newPath) {
        $scope.currentPath = newPath;
      });

      $scope.showNewItemView = function() {
        $location.path('/new');
      };

    }
  ]);

  $
  myKeolis.controller('HomeCtrl', [
    '$location', 'KService', '$scope', '$store', '$timeout',
    function($location, KService, $scope, $store, $timeout) {

      $scope.records = $store.get('records') || [];

      $scope.updateRecordSchedules = function(record) {
        delete record.schedules;
        var promise = KService.getSchedulesList(record.stop.refs);
        record.schedules = promise;
        return promise;
      };

      $scope.autoUpdateRecordSchedule = function(record) {
        $scope.updateRecordSchedules(record)
          .then(function() {
            $timeout($scope.autoUpdateRecordSchedule.bind(null, record), 5000);
          })
      };

    }
  ]);

  myKeolis.controller('NewItemCtrl', [
    '$rootScope', '$scope', 'KService', '$store', '$location',
    function($rootScope, $scope, KService, $store, $location) {

      $rootScope.newRecord = {};

      $scope.lines = KService.getLinesList();

      $scope.$watch('newRecord.line', function(line) {
        $scope.stops = null;
        if(line) {
          $scope.stops = KService.getStopsList(line.code, line.sens);
        }
      });

      $rootScope.saveNewRecord = function() {
        var records = $store.get('records') || [];
        records.push(angular.copy($rootScope.newRecord));
        $store.set('records', records);
        $rootScope.newRecord = {};
        $location.path('/');
      };

    }
  ]);
  
}(window))