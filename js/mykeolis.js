(function(w) {
  'use strict';
  var angular = w.angular;
  var moment = w.moment;
  var visibly = w.visibly;

  moment.lang('fr');

  var myKeolis = angular.module('myKeolis', [
    'ngAnimate',
    'ngRoute',
    'FirefoxOS',
    'localStorage',
    'ngTouch'
  ]);

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

  myKeolis.factory('visibly', ['$rootScope', function($rootScope) {

    var api = {
      isPageVisible: true
    };
    
    function updateVisibility(isPageVisible) {
      $rootScope.$apply(function() {
        api.isPageVisible = isPageVisible;
      });
    }

    visibly.onVisible(updateVisibility.bind(null, true));
    visibly.onHidden(updateVisibility.bind(null, false));

    return api; 
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

      function toScheduleObject(node) {
        var obj = toObject(node);
        var arr = obj.duree.split(':');
        obj.moment = moment().hour(+arr[0]).minute(+arr[1]);
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
            var schedules = transformXPathResult(xPathResult, toScheduleObject);
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
  
  myKeolis.controller('HomeCtrl', [
    '$location', 'KService', '$scope', '$store', '$timeout', 'visibly',
    function($location, KService, $scope, $store, $timeout, visibly) {

      $scope.records = $store.get('records') || [];
      
      $scope.visibly = visibly;

      $scope.$watch('visibly.isPageVisible', function(isPageVisible) {
        flushPendingUpdates();
        noMoreUpdates = true;
        if(isPageVisible) {
          noMoreUpdates = false;
          $scope.records.forEach($scope.autoUpdateRecordSchedule);
        }
      });

      var noMoreUpdates = false;
      var updatePromises = [];

      function flushPendingUpdates() {
        updatePromises.forEach($timeout.cancel);
      }

      $scope.$on('$destroy', function() {
        flushPendingUpdates();
        noMoreUpdates = true;
      });

      $scope.updateRecordSchedules = function(record) {
        record.schedules = record.schedules || [];
        var promise = KService.getSchedulesList(record.stop.refs);
        promise.then(function(schedules) {
          record.schedules.length = 0;
          record.schedules.push.apply(record.schedules, schedules);
        });
        return promise;
      };

      var REFRESH_RATE = 60 * 1000;

      $scope.autoUpdateRecordSchedule = function(record) {
        var promise = $scope.updateRecordSchedules(record);
        promise.then(function() {
          updatePromises.splice(updatePromises.indexOf(promise), 1);
          if(!noMoreUpdates) {
            $timeout(
              $scope.autoUpdateRecordSchedule.bind(null, record),
              REFRESH_RATE
            );
          }
        });
        updatePromises.push(promise);
      };

      $scope.removeRecord = function(record) {
        var index = $scope.records.indexOf(record);
        if(~index) {
          $scope.records.splice(index, 1);
          $store.set('records', $scope.records);
        }
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