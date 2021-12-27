/*
nuget Newtonsoft.Json
mv Newtonsoft.Json/net45/Newtonsoft.Json.dll Newtonsoft.Json.dll
dotnet csc nuget-json.cs /r:webcs.exe /r:Newtonsoft.Json.dll
nuget-json
*/
using System;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

class Program
{
    static void WebcsMain(WebcsProcess p)
    {
        // https://www.newtonsoft.com/json/help/html/CreateJsonManually.htm
        JArray array = new JArray();
        array.Add("Manual text");
        array.Add(new DateTime(2000, 5, 23));
        
        JObject o = new JObject();
        o["MyArray"] = array;
        
        p.WriteLine(o.ToString());
        p.Exit();
    }
    static void Main(){}
}