Build instruction:

Test plugin with project SandroProxyPlugin until it is ready.

1. To get jar that can be used in sandroproxy you should build with ant.
   First check local.properties file that it points to android sdk. (android update project --path .)
 
 ant debug
 
  There will be some warrnings about included jars (bsh,...). Just ignore them. They are not used yet.

2. Now you have file in assets dir that can be used in SandrProxy as plugin
   custom_plugin_dex.jar
   You can import to SandroProxy as local file (/mnt/sdcard/<file_name>.jar)
   or as web download (e.g: https://dl.dropbox.com/u/2323/<file_name>.jar)

