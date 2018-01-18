<?php
/**
 * Created by IntelliJ IDEA.
 * @author linuxwebexpert
 * @date 12/18/17 9:51 AM
 * @package modeify
 * @name notify
 */

/**
 * Turn on / off error reporting
 */
ini_set('display_errors', 'On');
ini_set('html_errors', 'On');
ini_set('log_errors', 'On');
ini_set('error_reporting', E_ALL && E_NOTICE);

ob_end_flush();
ob_implicit_flush(true);

header( 'Content-type: text/html; charset=utf-8' );

/**
 * Verify our secret token for sending emails
 * @param $fields
 * @param $token
 * @return bool
 */
function md5hash($pieces, $token, $glue) {
  $test = implode($glue, $pieces);
  $sum = md5($test);
  if ($token === $sum) {
    return true;
  }
  return $sum;
}

/**
 * Append the results to a log file
 * @param $result
 */
function writeLog($notify, $to, $result) {
  $fh = fopen($notify['log_file'], "a+") or die("Cannot open log file for writing!");
  fwrite($fh, date("Y-m-d H:i:s", time()) . "\t" . $_SERVER['REMOTE_ADDR'] . "\t$to\t$result\n");
  fclose($fh);
}

/**
 * Initialize defaults for notify
 */
define('_CR', "\r\n");
define('_LF', "\n");
$body = '';
$headers = array();
$text = '';
$html = '';
$err_msg = '';
$filename = 'notify.yaml';
$css = 'notify.css';
$image = 'empty';
$screencid = 'screenshot';
$logoimage = 'assets/images/application/vtalogotrans.png';
$logocid = 'vtalogotrans';

/**
 * Verify config file loaded properly
 */
if (is_file($filename)) {
  $notify = yaml_parse(file_get_contents($filename));
} else {
  die('Missing config file!');
}

/**
 * If not debug use $_POST values, otherwise use config file test parameters
 */
if (!$notify['debug']){
  if (!isset($_POST['name']) || empty($_POST['name'])) {
    $err_msg .= "NAME: not set!\n";
  }
  if (!isset($_POST['to']) || empty($_POST['to'])) {
    $err_msg .= "TO: not set!\n";
  }
  if (!isset($_POST['subject']) || empty($_POST['subject'])) {
      $err_msg .= "SUBJECT: not set!\n";
  }
  if (!isset($_POST['message']) || empty($_POST['message'])) {
    $err_msg .= "MESSGAGE: not set!\n";
  }
  if (!isset($_POST['link']) || empty($_POST['link'])) {
    $err_msg .= "LINK: not set!\n";
  }
  if (!isset($_POST['token']) || empty($_POST['token'])) {
    $err_msg .= "TOKEN: not set!\n";
  }
  $name = $_POST['name'];
  $to = $_POST['to'];
  $subject = $_POST['subject'];
  $message = $_POST['message'] . "\r\n";
  $link = $_POST['link'];
  $token = $_POST['token'];
} else {
  $name = $notify['test']['name'];
  $to = $notify['test']['to'];
  $subject = $notify['test']['subject'];
  $message = $notify['test']['message'];
  $link = $notify['test']['link'];
  $token = $notify['test']['token'];
}

/**
 * Verify token to prevent spam
 */
$fields = array();
$columns = $notify['md5_hash'];
if (!$notify['debug']) {
  foreach ($columns as $field) {
    $fields[] = $_POST[$field];
  }
} else {
  foreach ($columns as $field) {
    $fields[] = $notify['test'][$field];
  }
}
$md5string = md5hash($fields, $token, $notify['md5_glue']);
if ($md5string !== true) {
  $err_msg .= "MD5: not valid!\n$token <> $md5string\n";
  if($notify['debug']) {
    print_r($md5string);
  }
}

/**
 * Verify URL is VTA origin / destination
 */
if (!preg_match($notify['valid_url'], $link)) {
  $err_msg .= "LINK: Does not match VTA!";
}

if (!empty($err_msg)) {
  /**
   * Report and log the error and exit
   */
  echo "0\n";
  flush();
  ob_flush();

  $result = "ERROR: " . $err_msg;
  writeLog($notify, $to, $result);
  exit();
}

/**
 * Prepare the data for the mailer
 */
foreach ($notify['data_fields'] as $field) {
  if(!$notify['debug']) {
    $data[$field] = $_POST[$field];
  } else {
    $data[$field] = $notify['test'][$field];
  }
}
$serial = serialize($data);
$packet = base64_encode($serial);

if ($notify['debug']) {
  print_r($packet);
}

/**
 * Execute the mailer as background process
 */
$command = "php mailer.php $packet > /dev/null &";
exec($command);

/**
 * Echo true and exit
 */
echo "1\n";
flush();
ob_flush();

exit();
