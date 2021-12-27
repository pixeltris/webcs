/*
fs out newfile.txt
dotnet csc fileout.cs /r:webcs.exe
fileout
fs out newfile.txt
*/
using System;
using System.IO;

// Also try "fs in" which lets you copy files into the virtual file system from your device.
// NOTE: There currently isn't a way to invoke "fs out [PATH]" from C#.
class Program
{
    static void WebcsMain(WebcsProcess p)
    {
        File.WriteAllText(Path.Combine(p.CurrentDirectory, "newfile.txt"), "Some info that you want to save to your device");
        p.WriteLine("OK");
        p.Exit();
    }
    static void Main(){}
}