<?php
/**
 * Created by IntelliJ IDEA.
 * User: linuxwebexpert
 * Date: 1/17/18
 * Time: 11:19 AM
 */

/**
 * Turn on / off error reporting
 */
ini_set('display_errors', 'On');
ini_set('html_errors', 'On');
ini_set('log_errors', 'On');
ini_set('error_reporting', E_ALL && E_NOTICE);
ini_set('include_path', '.:/usr/share/php:/usr/bin');

set_time_limit(60);

ob_implicit_flush(1);

/**
 * Require Mail and Mail MIME packages from PEAR installation
 */
require_once ('Mail.php');
require_once ('Mail/mail.php');     // adds the enhanced send function
require_once ('Mail/mime.php');
require_once ('Mail/mimePart.php');

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

function decodePacket($packet) {
  $data = unserialize(base64_decode($packet));
  return $data;
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

if (isset($argv[1]) && !empty($argv[1])) {
  $data = decodePacket($argv[1]);
  if (!is_array($data)) {
    $err_msg .= "DECODE: Data packet not valid array";
  }
} else {
    $err_msg .= "PACKET: Not received from notify.php";
}

if ($notify['debug']) {
  print_r($data);
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
  if (preg_match('%sidePanel=true%', $data['link'])) {
    $fetch = preg_replace('%sidePanel=\w{1,}%', 'sidePanel=false', $data['link']);
  } else {
    $fetch = $data['link'] . "&sidePanel=false";
  }

  //$command = "/usr/bin/google-chrome --headless --virtual-time-budget=9999 --disable-gpu --screenshot --window='600,600' --disk-cache-size=0 --media-cache-size=0 --v8-cache-options=off --v8-cache-strategies-for-cache-storage=off --hide-scrollbars --deterministic-fetch '" . $fetch . "'";
  //$command = "/usr/bin/google-chrome --headless --virtual-time-budget=9999 --disable-gpu --screenshot --window='600,600' --hide-scrollbars --deterministic-fetch '" . $fetch . "'";
  $command = "node puppeteer.js '" . $fetch . "' 2>&1";

  if ($notify['debug']) {
    print_r($command);
  }

  exec($command, $output, $retval);

  if (isset($output[0]) && !empty($output[0])) {
    $image = $output[0];
  }

  if($notify['debug']) {
    print_r($image);
  }

  if (!preg_match('%screenshot-.*?\.png$%', $image)) {
    $err_msg .= "SCREENSHOT Failed to capture image! - $image - $fetch";
  }

  if (empty($err_msg)) {
    if (backgroundMasking($image) === 0) {
      $err_msg .= "BACKGROUND MASK failed!";
    }
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
$text .= $data['message'] . _LF;

/**
 * Create the HTML5 body content
 */
$style = file_get_contents($css);

/**
 * Explode the lines to create the steps
 */
$steps = '<table>' . _LF;
foreach (explode(_LF, $data['message']) as $line) {
  $steps .= '<tr><td>' . $line . '</td></tr>' . _LF;
}
$steps .= '</table>' . _LF;

$html = file_get_contents('notify.tpl');
$html = preg_replace('%<!--name-->%',$data['name'], $html);
$html = preg_replace('%<!--link-->%',$data['link'], $html);
$html = preg_replace('%<!--steps-->%',$steps, $html);
$html = preg_replace('%<!--subject-->%',$data['subject'], $html);

/**
 * Create a complaint mail using Mail MIME
 * @see https://pear.php.net/manual/en/package.mail.php
 */
$mime->setSubject($data['subject']);
$mime->setTXTBody($text);
$mime->setHTMLBody($html);
$body = $mime->get();
$hdrs = $mime->headers($headers);
$mail =& Mail::factory('mail', '-f ' . $notify['from_address']);

$retval = 0;
if (empty($err_msg)) {
  $retval = $mail->send($data['to'], $hdrs, $body);
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

writeLog($notify, $to, $result);

if($notify['debug']) {
  print_r($result);
}

exit();
