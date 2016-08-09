module.exports = function() {
  var testKey = 'test';
  return false; // disabled... don't want this!
  var storage = window.localStorage;
  try {
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return true;
  } catch (error) {
    return false;
  }
};
