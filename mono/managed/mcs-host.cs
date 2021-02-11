// csc /r:System.Net.Http.dll mcs-host.cs
//
// - mcs.exe was downloaded from https://download.mono-project.com/archive/6.12.0/macos-10-universal/MonoFramework-MDK-6.12.0.107.macos10.xamarin.universal.pkg
//   - Path of mcs.exe ~ MonoFramework-MDK-6.12.0.107.macos10.xamarin.universal.pkg\Payload~\.\Library\Frameworks\Mono.framework\Versions\6.12.0\lib\mono\4.5\mcs.exe
//
// The following modifications were made to mcs.exe (using dnSpy):
// - Edit "StaticLoader" ctor to add the "lastSeperatorIndex" check on "directoryName"
//   - int lastSeperatorIndex = directoryName.LastIndexOf(Path.DirectorySeparatorChar);
//   - string path = (lastSeperatorIndex >= 0) ? directoryName.Substring(0, lastSeperatorIndex) : directoryName;
//   - Console.WriteLine("mcs.exe targeting sdk version " + text2 + " - see https://github.com/mono/mono/blob/da11592cbea4269971f4b1f9624769a85cc10660/mcs/mcs/ikvm.cs#L244");
// - Edit "Driver.Main" to remove Environment.Exit calls (these kill mono)
using System;
using System.IO;
using System.Reflection;
using System.Threading.Tasks;
using System.Net.Http;

class Program
{
    static Assembly assembly = null;
    static string mcsSdkVer = "4.5";
    
    static void Main()
    {
        System.Console.WriteLine("mcs-host (Main) " + File.Exists("/idb/hello2.cs"));
        File.WriteAllText("/idb/hello2.cs", "hi");
        if (assembly == null)
        {
            assembly = Assembly.Load("mcs.exe");
            
            System.IO.File.WriteAllText("hello2.cs", @"// csc hello2.cs
class Program
{
    public static void Main()
    {
        System.Console.WriteLine(""Hello world"");
    }
}");
        }
        Directory.CreateDirectory(mcsSdkVer);
        
        if (!File.Exists(Path.Combine(mcsSdkVer, "mscorlib.dll")))
        {
            Task task = new Task(DownloadAndRun);
            task.Start();
        }
        else
        {
            Run();
        }
    }
    
    static async void DownloadAndRun()
    {
        string[] files = {"System.dll","System.Core.dll","mscorlib.dll"};
        string url = "http://localhost:80/mono/managed/sdk/";
        using (HttpClient httpClient = new HttpClient())
        {
            foreach (string file in files)
            {
                using (HttpResponseMessage response = await httpClient.GetAsync(url + file))
                using (HttpContent content = response.Content)
                {
                    Console.WriteLine("Downloading " + file);
                    byte[] buffer = await content.ReadAsByteArrayAsync();
                    Console.WriteLine("result '" + file + "' len:" + buffer.Length);
                    File.WriteAllBytes(Path.Combine(mcsSdkVer, file), buffer);
                }
            }
        }
        Run();
    }
    
    static void Run()
    {
        string[] args = {"hello2.cs"};
        MethodInfo method = assembly.GetType("Mono.CSharp.Driver").GetMethod("Main");
        method.Invoke(null, new object[]{args});
        foreach (string file in Directory.GetFiles(Environment.CurrentDirectory))
        {
            Console.WriteLine(file);
            if (new FileInfo(file).Extension == ".exe")
            {
                var asm = Assembly.LoadFrom(file);
                if (asm != null)
                {
                    Console.WriteLine("Loaded asm");
                    MethodInfo method2 = asm.GetType("Program").GetMethod("Main");
                    method2.Invoke(null, null);
                }
            }
        }
        foreach (string dir in Directory.GetDirectories(Environment.CurrentDirectory))
        {
            Console.WriteLine(dir);
        }
    }
}