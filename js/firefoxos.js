(function(w) {
  'use strict';
  var angular = w.angular;
  var FirefoxOS = angular.module('FirefoxOS', []);
  FirefoxOS.factory('systemXHR', [
    '$q',
    function($q) {

      var systemXHR = {};

      systemXHR.get = function(url) {
        var deferred = $q.deferred();
        var xhr = new XMLHttpRequest({mozSystem: true});
        xhr.onload = deferred.resolve;
        xhr.onerror = deferred.reject;
        xhr.open('get', url, true);
        xhr.send();
        return deferred.promise;
      };

      return systemXHR;

    }
  ]);
}(window))