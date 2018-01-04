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

/**
 * Require Mail and Mail MIME packages from PEAR installation
 */
require_once ('Mail.php');
require_once ('Mail/mail.php');     // adds the enhanced send function
require_once ('Mail/mime.php');
require_once ('Mail/mimePart.php');

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
  return $test;
}

/**
 * ImageMagick replace solid grey with transparency alpha
 * @see http://phpimagick.com/Tutorial/backgroundMasking
 * @see http://www.imagemagick.org/Usage/masking/#boolean_transparency
 */
function backgroundMasking($image)
{
  $command = 'convert ' . $image . ' -transparent rgb\(236,235,235\) ' . $image;
  $retval = null;
  $output = array();
  exec($command, $output, $retval);
  if ($retval !== 0) {
    return 0;
  }
  return 1;
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


if ($notify['debug']) {
  echo var_dump($notify);
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
 * Echo for testing purposes
 */
if ($notify['debug']) {
  echo "$name - $to - $subject - $message - $link - $token\n";
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
$result = md5hash($fields, $token, $notify['md5_glue']);
if ($result !== true) {
  $err_msg .= "MD5: not valid!\n$token <> $result\n";
}

/**
 * Verify URL is VTA origin / destination
 */
if (!preg_match($notify['valid_url'], $link)) {
  $err_msg .= "LINK: Does not match VTA!";
}

if (empty($err_msg)) {
  echo 1;
} else {
  echo 0;
}

/**
 * Create a MIME compliant mail message
 * @see https://pear.php.net/manual/en/package.mail.mail-mime.php
 */
$build_params = array(
  // What encoding to use for the headers
  // Options: quoted-printable or base64
  'head_encoding' => '8bit',
  // What encoding to use for plain text
  // Options: 7bit, 8bit, base64, or quoted-printable
  'text_encoding' => '7bit',
  // What encoding to use for html
  // Options: 7bit, 8bit, base64, or quoted-printable
  'html_encoding' => '8bit',
  // What encoding to use for calendar part
  // Options: 7bit, 8bit, base64, or quoted-printable
  'calendar_encoding' => 'quoted-printable',
  // The character set to use for html
  'html_charset'  => 'UTF-8',
  // The character set to use for text
  'text_charset'  => 'ISO-8859-1',
  // The character set to use for calendar part
  'calendar_charset'  => 'UTF-8',
  // The character set to use for headers
  'head_charset'  => 'UTF-8',
  // End-of-line sequence
  'eol'           => "\r\n",
  // Delay attachment files IO until building the message
  'delay_file_io' => false,
  // Default calendar method
  'calendar_method' => 'request',
  // multipart part preamble (RFC2046 5.1.1)
  'preamble' => '',
);
$mime = new Mail_mime($build_params);

/**
 * Initialize the MIME email variables for both HTML & Plain Text
 */

/**
 * Set headers for email
 */
$headers[] = "MIME-Version: 1.0";
$headers[] = "From: VTA Trip Planner <" . $notify['from_address'] . ">";
$headers[] = "To: " . $to;
$headers[] = "X-Mailer: PHP/" . phpversion();

/**
 * Take a screenshot of the page using headless chrome
 */
if (empty($err_msg)) {
  $retval = NULL;
  $output = array();
  if (preg_match('%sidePanel=\w{1,}%', $link)) {
    $fetch = preg_replace('%sidePanel=true%', 'sidePanel=false', $link);
  }
  else {
    $fetch = $link . "&sidePanel=false";
  }
//$command = "/usr/bin/google-chrome --headless --virtual-time-budget=9999 --disable-gpu --screenshot --window='600,600' --disk-cache-size=0 --media-cache-size=0 --v8-cache-options=off --v8-cache-strategies-for-cache-storage=off --hide-scrollbars --deterministic-fetch '" . $fetch . "'";
//$command = "/usr/bin/google-chrome --headless --virtual-time-budget=9999 --disable-gpu --screenshot --window='600,600' --hide-scrollbars --deterministic-fetch '" . $fetch . "'";
  $command = "node puppeteer.js '" . $fetch . "' 2>&1";
  exec($command, $output, $retval);

  if (isset($output[0]) && !empty($output[0])) {
    $image = $output[0];
  }

  if (!preg_match('%screenshot-.*?\.png$%', $image)) {
    $err_msg .= "SCREENSHOT Failed to capture image! - $image";
  }
  if (backgroundMasking($image) === 0) {
    $err_msg .= "BACKGROUND MASK failed!";
  }
}
/**
 * Add the Logo & Screenshot images inline as base64 HTML and set Content-ID per RFC2392
 * @see https://www.ietf.org/rfc/rfc2392.txt
 */
$mime->addHTMLImage($image, "image/png", "route.png", true, uniqid($screnncid,FALSE));
$mime->addHTMLImage($logoimage, "image/png", "logo.png", true, uniqid($logocid,FALSE));

/**
 * Create Plain Text body content
 */
$text .= $message . _LF;

/**
 * Create the HTML5 body content
 */
$style = file_get_contents($css);

/**
 * Explode the lines to create the steps 
 */
$steps = '<table>' . _LF;
foreach (explode(_LF, $message) as $line) {
  $steps .= '<tr><td>' . $line . '</td></tr>' . _LF;
}
$steps .= '</table>' . _LF;

$html = file_get_contents('notify.tpl');
$html = preg_replace('%<!--name-->%',$name, $html);
$html = preg_replace('%<!--link-->%',$link, $html);
$html = preg_replace('%<!--steps-->%',$steps, $html);
$html = preg_replace('%<!--subject-->%',$subject, $html);

/**
 * Create a complaint mail using Mail MIME
 * @see https://pear.php.net/manual/en/package.mail.php
 */
$mime->setSubject($subject);
$mime->setTXTBody($text);
$mime->setHTMLBody($html);
$body = $mime->get();
$hdrs = $mime->headers($headers);
$mail =& Mail::factory('mail', '-f ' . $notify['from_address']);

$retval = 0;
if (empty($err_msg)) {
  $retval = $mail->send($to, $hdrs, $body);
}
if ($retval === 0) {
  $err_msg .= "SENDMAIL: failed!";
}

/**
 * Set the result for the log file
 */
if (empty($err_msg)) {
  $result = "OK";
} else {
  $result = "ERROR: " . $err_msg;
}

/**
 * Append the results to a log file
 */
$fh = fopen($notify['log_file'], "a+") or die("Cannot open log file for writing!");
fwrite($fh, date("Y-m-d H:i:s", time()) . "\t" . $_SERVER['REMOTE_ADDR'] . "\t$to\t$result\n");
fclose($fh);

exit();
