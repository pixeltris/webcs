/*
ls newfolder
dotnet csc process-cwd.cs /r:webcs.exe
process-cwd
ls newfolder
*/
using System;
using System.IO;

class Program
{
    static void WebcsMain(WebcsProcess p)
    {
        string dir = Path.Combine(p.CurrentDirectory, "newfolder");
        if (!Directory.Exists(dir))
        {
            Directory.CreateDirectory(dir);
        }
        string file = Path.Combine(dir, "newfile.txt");
        string text = "This text was written into the folder 'newfolder' which was created in the current working directory";
        File.WriteAllText(file, text);
        if (File.ReadAllText(file) == text)
        {
            p.WriteLine("OK");
        }
        else
        {
            p.WriteLine("ERROR");
        }
        p.Exit();
    }
    static void Main(){}
}