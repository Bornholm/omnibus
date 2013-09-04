(function(w) {
  'use strict';
  var angular = w.angular;

  var myKeolis = angular.module('myKeolis', ['FirefoxOS']);

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

      KService.getLinesServiceURL = function() {
       return endpoint + cityCode + '.php?xml=1';
      };

      KService.getLinesList = function() {
        var deferred = $q.defer();
        var url = KService.getLinesServiceURL();
        var xhr = new XMLHttpRequest({mozSystem: true});
        xhr.onload = function() {
          console.log(this.responseText);
        };
        xhr.open('get', url, true);
        xhr.send();
        return deferred.promise;
      };

      return KService;
    }
  ]);

  myKeolis.controller('NavBarCtrl', [
    '$scope', '$location',
    function($scope, $location) {

      $scope.showNewItemView = function() {
        $location.path('/new');
      };

    }
  ]);

  myKeolis.controller('HomeCtrl', [
    '$scope', '$location', 'KService',
    function($scope, $location, KService) {

      $scope.items = new Array(10);

      KService
        .setKeolisEndpoint('http://timeo3.keolis.com/relais/')
        .setCityCode(117);

      KService.getLinesList();
    }
  ]);

  myKeolis.controller('NewItemCtrl', [
    '$scope',
    function($scope) {

    }
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
  
}(window))