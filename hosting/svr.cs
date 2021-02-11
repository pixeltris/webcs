using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Net;
using System.IO;

// csc svr.cs
// Simple server that gives the browser whatever it wants...
class SimpleFileServer
{
    static void Main()
    {
        SimpleFileServer svr = new SimpleFileServer();
        svr.Start();
        Console.WriteLine("Started on http://localhost:" + svr.Port);
        Console.ReadLine();
    }
    
    private Thread thread;
    private HttpListener listener;
    private string rootDirectory;

    public int Port { get; set; }

    public SimpleFileServer(int port = 80)
    {
        Port = port;
    }

    public void Start()
    {
        rootDirectory = Path.GetFullPath(Environment.CurrentDirectory);
        DirectoryInfo dirInfo = new DirectoryInfo(rootDirectory);
        if (dirInfo.Name == "hosting" && !Directory.Exists(Path.Combine(dirInfo.FullName, "hosting")))
        {
            // If we are in the "hosting" directory, set the root directory to one above that (as that's the root directory)
            rootDirectory = dirInfo.Parent.FullName;
        }

        thread = new Thread(delegate()
        {
            listener = new HttpListener();
            listener.Prefixes.Add("http://localhost:" + Port + "/");
            listener.Start();
            while (listener != null)
            {
                try
                {
                    HttpListenerContext context = listener.GetContext();
                    Process(context);
                }
                catch
                {
                }
            }
        });
        thread.IsBackground = true;
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
    }

    private void Process(HttpListenerContext context)
    {
        string filename = context.Request.Url.AbsolutePath;
        Console.WriteLine(filename);
        filename = filename.Substring(1);
        if (string.IsNullOrEmpty(filename))
        {
            filename = "index.html";
        }
        if (IsValidFilePath(filename) && File.Exists(filename = Path.Combine(rootDirectory, filename)))
        {
            try
            {
                using(Stream input = new FileStream(filename, FileMode.Open))
                {
                    //Adding permanent http response headers
                    string mime;
                    context.Response.ContentType = mimeTypeMappings.TryGetValue(Path.GetExtension(filename), out mime) ? mime : "application/octet-stream";
                    context.Response.ContentLength64 = input.Length;
                    context.Response.AddHeader("Date", DateTime.Now.ToString("r"));
                    context.Response.AddHeader("Last-Modified", System.IO.File.GetLastWriteTime(filename).ToString("r"));
                    //context.Response.AddHeader("Access-Control-Allow-Origin", "*");
                    
                    byte[] buffer = new byte[1024 * 16];
                    int nbytes;
                    while ((nbytes = input.Read(buffer, 0, buffer.Length)) > 0)
                    {
                        context.Response.OutputStream.Write(buffer, 0, nbytes);
                    }
                    context.Response.OutputStream.Flush();
                    context.Response.StatusCode = (int)HttpStatusCode.OK;
                }
            }
            catch (Exception e)
            {
                context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
                Console.WriteLine(e);
            }
        }
        else
        {
            context.Response.StatusCode = (int)HttpStatusCode.NotFound;
        }
        context.Response.OutputStream.Close();
    }
    
    private static bool IsValidFilePath(string path)
    {
        // Maybe cache the invalid chars rather than checking for '/' and '\' each time...
        char[] invalidChars = Path.GetInvalidFileNameChars();
        return !path.Contains("../") && !path.Contains("..\\") && !invalidChars.Any(x => x != '/' && x != '\\' && path.Contains(x));
    }
    
    private static IDictionary<string, string> mimeTypeMappings = new Dictionary<string, string>(StringComparer.InvariantCultureIgnoreCase)
    {
        {".asf", "video/x-ms-asf"},
        {".asx", "video/x-ms-asf"},
        {".avi", "video/x-msvideo"},
        {".bin", "application/octet-stream"},
        {".cco", "application/x-cocoa"},
        {".crt", "application/x-x509-ca-cert"},
        {".css", "text/css"},
        {".deb", "application/octet-stream"},
        {".der", "application/x-x509-ca-cert"},
        {".dll", "application/octet-stream"},
        {".dmg", "application/octet-stream"},
        {".ear", "application/java-archive"},
        {".eot", "application/octet-stream"},
        {".exe", "application/octet-stream"},
        {".flv", "video/x-flv"},
        {".gif", "image/gif"},
        {".hqx", "application/mac-binhex40"},
        {".htc", "text/x-component"},
        {".htm", "text/html"},
        {".html", "text/html"},
        {".ico", "image/x-icon"},
        {".img", "application/octet-stream"},
        {".iso", "application/octet-stream"},
        {".jar", "application/java-archive"},
        {".jardiff", "application/x-java-archive-diff"},
        {".jng", "image/x-jng"},
        {".jnlp", "application/x-java-jnlp-file"},
        {".jpeg", "image/jpeg"},
        {".jpg", "image/jpeg"},
        {".js", "application/x-javascript"},
        {".mml", "text/mathml"},
        {".mng", "video/x-mng"},
        {".mov", "video/quicktime"},
        {".mp3", "audio/mpeg"},
        {".mpeg", "video/mpeg"},
        {".mpg", "video/mpeg"},
        {".msi", "application/octet-stream"},
        {".msm", "application/octet-stream"},
        {".msp", "application/octet-stream"},
        {".pdb", "application/x-pilot"},
        {".pdf", "application/pdf"},
        {".pem", "application/x-x509-ca-cert"},
        {".pl", "application/x-perl"},
        {".pm", "application/x-perl"},
        {".png", "image/png"},
        {".prc", "application/x-pilot"},
        {".ra", "audio/x-realaudio"},
        {".rar", "application/x-rar-compressed"},
        {".rpm", "application/x-redhat-package-manager"},
        {".rss", "text/xml"},
        {".run", "application/x-makeself"},
        {".sea", "application/x-sea"},
        {".shtml", "text/html"},
        {".sit", "application/x-stuffit"},
        {".swf", "application/x-shockwave-flash"},
        {".tcl", "application/x-tcl"},
        {".tk", "application/x-tcl"},
        {".txt", "text/plain"},
        {".war", "application/java-archive"},
        {".wbmp", "image/vnd.wap.wbmp"},
        {".wmv", "video/x-ms-wmv"},
        {".xml", "text/xml"},
        {".xpi", "application/x-xpinstall"},
        {".zip", "application/zip"},
        {".wasm", "application/wasm"},
    };
}