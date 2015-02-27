(function(w) {
  'use strict';
  var angular = w.angular;
  var moment = w.moment;
  var visibly = w.visibly;

  moment.lang('fr');

  var CORS_PROXY = 'http://omnibus.lookingfora.name';

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

  var myKeolis = angular.module('Omnibus', [
    'ngRoute',
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
    var endpoint = CORS_PROXY+'/relais/';
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
    '$http', '$q',
    function($http, $q) {

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

      function transformNodes(nodes, transform) {
        var res = [];
        for(var i = 0, len = nodes.length; i < len; ++i) {
          res.push(transform(nodes[i]));
        }
        return res;
      }

      function toObject(node) {
        var obj = {};
        var len = node.childNodes.length;
        var child;
        while(len--) {
          child = node.childNodes[len];
          obj[child.nodeName] = child.textContent;
        }
        return obj;
      }

      function toStopObject(node) {
        var obj = toObject(node.childNodes[1]);
        obj.refs = node.childNodes[5].textContent;
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
        $http.get(url)
          .then(function(res) {
            var xml = new DOMParser().parseFromString(res.data, 'text/xml');
            var nodes = xml.querySelectorAll('xmldata alss als ligne');
            var lines = transformNodes(nodes, toObject);
            return deferred.resolve(lines);
          });
        return deferred.promise;
      };

      KService.getStopsList = function(cityCode, codeLigne, sens) {
        var deferred = $q.defer();
        var url = KService.getStopsServiceURL(cityCode, codeLigne, sens);
        $http.get(url)
          .then(function(res) {
            var xml = new DOMParser().parseFromString(res.data, 'text/xml');
            var nodes = xml.querySelectorAll('xmldata alss als');
            var stops = transformNodes(nodes, toStopObject);
            return deferred.resolve(stops);
          });
        return deferred.promise;
      };

      KService.getSchedulesList = function(cityCode, refsArret) {
        var deferred = $q.defer();
        var url = KService.getSchedulesServiceURL(cityCode, refsArret);
        $http.get(url)
          .then(function(res) {
            var xml = new DOMParser().parseFromString(res.data, 'text/xml');
            var nodes = xml.querySelectorAll('xmldata horaires horaire passages passage');
            var schedules = transformNodes(nodes, toScheduleObject);
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
