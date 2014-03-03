(function(w) {
  'use strict';
  var angular = w.angular;
  var moment = w.moment;
  var visibly = w.visibly;

  moment.lang('fr');

  var CITIES = [
    {name: 'Dijon', code: 217},
    {name: 'Pau', code: 117},
    {name: 'Le Mans', code: 105},
    {name: 'Aix en Provence', code: 135},
    {name: 'Soissons', code: 120},
    {name: 'Caen', code: 147},
    {name: 'Brest', code: 297},
    {name: 'Pau-Agen', code: 402},
    {name: 'St Etienne', code: 422},
    {name: 'Nantes', code: 440},
    {name: 'Montargis', code: 457},
    {name: 'Angers', code: 497},
    {name: 'Macon-Villefranche', code: 691},
    {name: 'Epinay-sur-Orge', code: 910},
    {name: 'Rennes', code: 999}
  ];

  var myKeolis = angular.module('myKeolis', [
    'ngRoute',
    'FirefoxOS',
    'angularLocalStorage',
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

  /* Bootstrap application */
  myKeolis.run(['KService', function(KService) {
    var endpoint = 'http://www.corsproxy.com/timeo3.keolis.com/relais/';
    KService.setKeolisEndpoint(endpoint);
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

      var endpoint;

      KService.setKeolisEndpoint = function(url) {
        endpoint = url;
        return KService;
      };

      KService.getSchedulesServiceURL = function(cityCode, refsArret) {
       return endpoint + cityCode + '.php?xml=3&ran=1&refs='+refsArret;
      };

      KService.getLinesServiceURL = function(cityCode) {
       return endpoint + cityCode + '.php?xml=1';
      };

      KService.getStopsServiceURL = function(cityCode, codeLigne, sens) {
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

      KService.getLinesList = function(cityCode) {
        var deferred = $q.defer();
        var url = KService.getLinesServiceURL(cityCode);
        systemXHR(url)
          .then(function(xhr) {
            var xml = new DOMParser().parseFromString(xhr.responseText, 'text/xml');
            var xPathResult = xml.evaluate('//alss/als/ligne', xml, null, XPathResult.ANY_TYPE, null);
            var lines = transformXPathResult(xPathResult, toObject);
            return deferred.resolve(lines);
          });
        return deferred.promise;
      };

      KService.getStopsList = function(cityCode, codeLigne, sens) {
        var deferred = $q.defer();
        var url = KService.getStopsServiceURL(cityCode, codeLigne, sens);
        systemXHR(url)
          .then(function(xhr) {
            var xml = new DOMParser().parseFromString(xhr.responseText, 'text/xml');
            var xPathResult = xml.evaluate('//alss/als', xml, null, XPathResult.ANY_TYPE, null);
            var stops = transformXPathResult(xPathResult, toStopObject);
            return deferred.resolve(stops);
          });
        return deferred.promise;
      };

      KService.getSchedulesList = function(cityCode, refsArret) {
        var deferred = $q.defer();
        var url = KService.getSchedulesServiceURL(cityCode, refsArret);
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
    '$location', 'KService', '$scope', 'storage', '$timeout', 'visibly',
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
        var promise = KService.getSchedulesList(record.city.code, record.stop.refs);
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
    '$rootScope', '$scope', 'KService', 'storage', '$location',
    function($rootScope, $scope, KService, $store, $location) {

      $scope.cities = CITIES;

      var newRecord = $rootScope.newRecord = {};

      $scope.$watch('newRecord.city', function(city) {
        $scope.stops = null;
        $scope.lines = null;
        if(city) {
          KService
            .getLinesList(city.code)
            .then(function(lines) {
              $scope.lines = lines;
            });
        }
      });

      $scope.$watch('newRecord.line', function(line) {
        $scope.stops = null;
        if(line) {
          KService
          .getStopsList(newRecord.city.code, line.code, line.sens)
          .then(function(stops) {
            $scope.stops = stops;
          });
        }
      });

      $rootScope.saveNewRecord = function() {
        var records = $store.get('records') || [];
        records.push(angular.copy(newRecord));
        $store.set('records', records);
        newRecord = $rootScope.newRecord = {};
        $location.path('/');
      };

    }
  ]);
  
}(window))