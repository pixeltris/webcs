/*
dotnet csc process-args.cs /r:webcs.exe
process-args arg1 arg2 "hello world"
*/
using System;

class Program
{
    static void WebcsMain(WebcsProcess p)
    {
        if (p.Args.Length == 0)
        {
            p.WriteLine("No args!");
        }
        else
        {
            p.WriteLine("Args:");
            foreach (string arg in p.Args)
            {
                p.WriteLine("'" + arg + "'");
            }
        }
        p.Exit();
    }
    static void Main(){}
}