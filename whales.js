/* SOXX Sniper · Whale watch
   Tracks the 20 best and 20 worst SOXL traders on Hyperliquid (xyz:SOXL perpetual), live.
   Wallet list: SOXL trader study of Oct 28, 2026 (full SOXL profit from Hyperdash; 248 wallets studied).
   Positions: Hyperliquid info API (clearinghouseState, dex "xyz"), every minute, also when the tab is in the background.
   Top-trader moves: the real fills of the top 20 wallets (userFills / userFillsByTime), merged into one move per
   wallet, side and action when the fills are less than 15 minutes apart. So a trader who adds to a short in
   many small orders shows as one growing move with the right time.
   Alerts: top-trader moves of $50K or more (and every $100K more); worst-wallet position changes against the size at the
   last alert (so slow adds are caught); a large position near liquidation.
   Depends on globals from index.html: $, Q, FUND, alert1, fmtPx, fmtPct, esc, lsGet, lsSet. */
(function () {
  "use strict";
  // [address, group (B = best, W = worst), SOXL profit $, SOXL trades, win rate %, Hyperdash cohort]
  const LIST = [["0x024294c53a69c1e6b39810b3fac87385752fffa1","B",816922,295,42,"Extremely Profitable"],["0xbb475febf78b528f4f0d4ae1a12541406565199c","B",327741,60,51.7,"Extremely Profitable"],["0xbd697846b0911baeba002a56bdc16f1f332d45fb","B",257584,96,41.7,"Rekt"],["0x9dead8fffcbf130e7658f672d2c081d91178d617","B",228553,6,100,"Extremely Profitable"],["0xda3768e9299e1fd81708ec030dac5ea37125f7b5","B",211500,36,47.2,"Rekt"],["0x8bd30fc805e672e1d978138ecbedcb48479ce275","B",202636,5,60,"Very Profitable"],["0xfc27136e42af1732ddc9ce2605ea9bff1b959d9d","B",110328,80,38.8,"Extremely Profitable"],["0x3b2e0b95acd47d987c1abdf42967fd82d469bdbb","B",98782,43,60.5,"Very Profitable"],["0x90e56dc997fea87c8463d661e621b1e7fd5181af","B",90533,60,55,"Very Profitable"],["0xec85bc052ec5b6d6cb2b40f5caa45e39b61a77fe","B",67178,10,30,"Very Unprofitable"],["0x177019594ba3913d416ab1a8f3e5527d4c2b2837","B",54572,2415,50.4,"Profitable"],["0xa38f19c4ccbcfd64cff676d72c436f7e6239dccf","B",49333,55,67.3,"Very Profitable"],["0xd33c704c68518e527bdcb36f7966c80edcffbdf2","B",40319,75,62.7,"Very Profitable"],["0x37f7ff1864f5d5cba2b63592656049f2d7d06fb4","B",40027,6,50,"Profitable"],["0x421183f04d68d0c2c68e27f07ccf84cd8746b9ef","B",37272,3,33.3,"Very Profitable"],["0x6d9d3438d8ad0506c74d0b91c68fa6b8f58154e6","B",37005,5,100,"Profitable"],["0x0b1ace05eb9ef1c3a1951b763700ecad24f27741","B",35729,6229,57.2,"Extremely Profitable"],["0x7717a7a245d9f950e586822b8c9b46863ed7bd7e","B",33448,71,63.4,"Extremely Profitable"],["0xb45bacc19c5f71ca8ba4134b0bbe6f4a1e9a5b11","B",26524,42,61.9,"Very Profitable"],["0x1886d6d9b05f11e9db19ba6f84811bb80d4c6582","B",22491,4,100,"Unprofitable"],["0xda411866ef8da115945db1c4987f44cb02c5d3f1","W",-1679857,5,20,"Rekt"],["0x4bcc092a156905788bf2a1a59e5968623957210d","W",-547814,482,57.3,"Very Profitable"],["0xd52936fa285cfa500440e31355c0b28f4b740729","W",-522826,11025,40.4,"Rekt"],["0xfd4224606069dd88fec92093a27591008263fda5","W",-90051,72,44.4,"Very Unprofitable"],["0xe724acd020fbd65ddb42a0f05dcfb65489480320","W",-80456,10,50,"Unprofitable"],["0x7f5653978d3f1b9716140bb7304c7e4650ae50f6","W",-62676,24,33.3,"Unprofitable"],["0xfc667adba8d4837586078f4fdcdc29804337ca06","W",-59080,16,56.3,"Extremely Profitable"],["0x25773676902085225ae5751075e4161369334897","W",-58715,1811,45.6,"Extremely Profitable"],["0xe9ffe7698f46f96f980f2877e18c43f5b4165903","W",-52483,34,44.1,"Rekt"],["0x7cee351d68e21f2bf1adf8161bd1598a80d6fc93","W",-44249,20,35,"Rekt"],["0xf1e79e5cf063073deec9a0d86c178f7cde84d479","W",-221468,11,0,"Found Oct 30"],["0xb28bdcb4c7db9370b73f6dbd57671416a0a57dd6","W",-110173,9,100,"Found Oct 30"],["0xc473eeadb5c500b010f6f882f922a394af09302a","W",-55359,264,55.1,"Found Oct 30"],["0xa4dedda59f2908b92ae192cfd494839373bcb3c4","W",-23872,67,68.8,"Found Oct 30"],["0x6ba2ad09aa6629a423b59b71f3564d84ce66c001","W",-22030,137,0,"Found Oct 30"],["0xbeccae9ffcb69e9d42a1d4e744abf8056149562d","W",-18168,19,0,"Found Oct 30"],["0xc3b27ac6b2e45b2b50e67fc805f7b2aac263daee","W",-6828,602,50.8,"Found Oct 30"],["0x2dbc53fe4683a9308feb5cd88ab10d73ad220b3d","W",-6199,169,0,"Found Oct 30"],["0xc06dd151c27dbe535ae95797e8aab1bb8b8cc7c0","W",-3148,70,16.4,"Found Oct 30"],["0xb1bfb0476bcdfc7989250e606312e6d716c11706","W",-1515,187,51.8,"Found Oct 30"]];
  // Trader profiles: from each wallet's SOXL fills on Hyperliquid (study of Oct 30, 2026). tags, stats, what works, what does not, tendencies
  const STATS = {"0x024294c53a69c1e6b39810b3fac87385752fffa1":["B",834,1793338797513,1793377095304,2174678,-14966,0,1,null,null,0,null,0,0,null,0,0,0,0,0,0,null,null,null,0,0,0,null,0,0,0,0,0,null,0,0,0,{"rth":0.64,"pre":0.054,"post":0,"night":0.306,"wknd":0},{},[0,0,null],[-1,1793338797513,555]],"0xbb475febf78b528f4f0d4ae1a12541406565199c":["B",1485,1793359725064,1793377156995,4110747,12245,0.196,1,null,null,0,null,0,0,null,0,0,0,0,0,0,null,null,null,0,0,0,null,0,0,0,0,0,null,0,0,0,{"rth":0.704,"pre":0.296,"post":0,"night":0,"wknd":0},{},[0,0,null],[-1,1793359725064,1052]],"0xbd697846b0911baeba002a56bdc16f1f332d45fb":["B",1604,1790246191521,1793363823727,109885778,-143461,0.07,1,null,null,81,0.358,12448,7632,0.91,49702,-55659,57,24,-55747,19851,0.316,0.458,94.761,0.235,322243,2708632,0.606,66,0.642,129,331,-74119,0.323,31,0.63,1,{"rth":0.458,"pre":0.133,"post":0.177,"night":0.154,"wknd":0.078},{"pre":[11,73951],"night":[11,-17111],"wknd":[8,-54449],"rth":[36,-23684],"post":[15,-14603]},[75,-43635,0.347],[1,1793362064871,1]],"0x9dead8fffcbf130e7658f672d2c081d91178d617":["B",240,1792966726099,1793217676710,221613,-4.521,1,1,null,null,0,null,0,0,null,0,0,0,0,0,0,null,null,null,0,0,0,null,0,0,0,0,0,null,0,0,0,{"rth":0.497,"pre":0.351,"post":0.01,"night":0.109,"wknd":0.033},{},[0,0,null],[-1,1792966726099,240]],"0xda3768e9299e1fd81708ec030dac5ea37125f7b5":["B",2860,1792369528964,1793376693820,17691746,65233,0.99,1,null,null,11,0.545,1597,1056,1.814,6951,-3525,6,5,-893,5194,0.833,0.2,178,0.182,70560,581726,0.375,8,0.818,26,16,4582,0.571,7,0.818,11,{"rth":0.723,"pre":0.024,"post":0.069,"night":0.169,"wknd":0.015},{"rth":[7,4819],"post":[1,-143],"pre":[2,-462],"night":[1,86.873]},[11,4301,0.545],[-1,1793325705116,12]],"0x8bd30fc805e672e1d978138ecbedcb48479ce275":["B",599,1792979541690,1793345507597,820686,19616,0,1,null,null,2,1,17.224,0,null,19.014,15.434,2,0,34.448,0,1,null,250,0.5,2748,2748,1,1,1,1,1,19.014,1,1,1,0,{"rth":0.062,"pre":0.187,"post":0.16,"night":0.59,"wknd":0.002},{"wknd":[1,19.014],"post":[1,15.434]},[2,34.448,1],[-1,1793155656948,457]],"0xfc27136e42af1732ddc9ce2605ea9bff1b959d9d":["B",452,1793347647401,1793377284623,1715901,17503,0.072,1,null,null,0,null,0,0,null,0,0,0,0,0,0,null,null,null,0,0,0,null,0,0,0,0,0,null,0,0,0,{"rth":0.637,"pre":0.363,"post":0,"night":0,"wknd":0},{},[0,0,null],[-1,1793347647401,352]],"0x3b2e0b95acd47d987c1abdf42967fd82d469bdbb":["B",2104,1790615692802,1793376487763,23094791,100651,0.45,1,null,null,44,0.568,5299,1836,3.797,91209,-21544,2,42,-1141,98721,0.5,0.571,16.883,0.205,59969,752382,0.514,35,0.818,309,584,93648,0.571,21,0.705,1,{"rth":0.805,"pre":0.132,"post":0.063,"night":0,"wknd":0},{"rth":[33,81025],"pre":[6,13702],"post":[5,2852]},[34,97133,0.588],[-1,1793367113281,110]],"0x90e56dc997fea87c8463d661e621b1e7fd5181af":["B",897,1793271865603,1793377053521,5011126,32523,1,1,null,null,7,0.571,127,2359,0.072,191,-6082,3,4,-6327,-241,0.333,0.75,63.824,0.143,73066,579294,0.429,7,0.857,138,66,-6707,0.5,6,0.857,4,{"rth":0.344,"pre":0.236,"post":0.228,"night":0.192,"wknd":0},{"post":[3,-6451],"pre":[4,-118]},[7,-6568,0.571],[1,1793366880706,114]],"0xec85bc052ec5b6d6cb2b40f5caa45e39b61a77fe":["B",82,1792904866757,1792972169509,219752,-495,0,1,null,null,0,null,0,0,null,0,0,0,0,0,0,null,null,null,0,0,0,null,0,0,0,0,0,null,0,0,0,{"rth":0,"pre":0,"post":0,"night":0,"wknd":1},{},[0,0,null],[-1,1792904866757,45]],"0x177019594ba3913d416ab1a8f3e5527d4c2b2837":["B",1409,1793369393008,1793377614577,3546199,978,1,1,null,null,19,0.474,264,141,1.688,888,-504,10,9,-354,1322,0.4,0.556,2.86,0,29429,96945,0.526,19,0.895,212,299,951,0.5,14,0.842,19,{"rth":1,"pre":0,"post":0,"night":0,"wknd":0},{"rth":[19,968]},[19,968,0.474],[-1,1793374890934,188]],"0xa38f19c4ccbcfd64cff676d72c436f7e6239dccf":["B",154,1793220304100,1793376014109,2422806,-4341,0.99,1,null,null,7,0.571,1600,4491,0.475,4415,-8259,4,3,-13174,6101,0.25,1,90.772,0.286,136583,198052,0.667,6,0.857,46,17,-7137,0.5,6,0.714,7,{"rth":0.291,"pre":0.078,"post":0.609,"night":0.022,"wknd":0},{"post":[6,-11488],"pre":[1,4415]},[7,-7073,0.571],[-1,1793370487779,15]],"0xd33c704c68518e527bdcb36f7966c80edcffbdf2":["B",187,1792677119531,1793374896982,12261191,-20684,0.744,1,null,null,9,0.778,6046,19212,1.101,36237,-31862,4,5,5276,-1378,0.75,0.8,432,0.333,466734,764297,0.75,8,0.778,46,7,3402,0.714,7,0.778,9,{"rth":0.44,"pre":0.084,"post":0.314,"night":0.149,"wknd":0.014},{"rth":[1,30.035],"night":[3,38927],"pre":[2,-3841],"post":[3,-31218]},[9,3898,0.778],[1,1793304687356,7]],"0x37f7ff1864f5d5cba2b63592656049f2d7d06fb4":["B",165,1787054164751,1793376990447,1515374,40009,0.234,0,null,null,6,0.5,2971,715,4.158,8638,-1596,6,0,6770,0,0.5,null,1705,0.667,44335,66520,1,4,0.833,8,3,-1941,0.25,4,0.167,0,{"rth":0.464,"pre":0.237,"post":0,"night":0.175,"wknd":0.125},{"pre":[3,-1513],"rth":[2,8211],"wknd":[1,72.237]},[0,0,null],[1,1792036882294,128]],"0x421183f04d68d0c2c68e27f07ccf84cd8746b9ef":["B",87,1793019361419,1793248279648,1447991,38338,0.118,0,null,null,5,0.4,20565,931,14.729,38532,-1907,5,0,38338,0,0.4,null,28.892,0.4,148229,263908,0.4,5,0.4,19,55,41131,1,2,0.4,0,{"rth":0.545,"pre":0.174,"post":0.105,"night":0.177,"wknd":0},{"pre":[1,-764],"rth":[2,36625],"post":[1,2599],"night":[1,-122]},[5,38338,0.4],null],"0x6d9d3438d8ad0506c74d0b91c68fa6b8f58154e6":["B",23,1787664518253,1793177958887,438954,37005,0.062,0,null,null,5,1,7415,0,null,33504,127,4,1,36819,256,1,1,8251,0.8,15626,125288,0.5,4,0.4,2,2,2894,1,2,0,0,{"rth":0.433,"pre":0.385,"post":0.048,"night":0,"wknd":0.134},{"pre":[3,33887],"post":[1,421],"rth":[1,2767]},[2,33760,1],[1,1792158251965,8]],"0x0b1ace05eb9ef1c3a1951b763700ecad24f27741":["B",1913,1793366987165,1793377842903,4583162,367,0.947,1,null,null,86,0.535,67.68,71.517,1.088,533,-611,43,43,-1140,1392,0.419,0.651,0.711,0,15761,99748,0.5,86,0.872,539,302,279,0.55,60,0.733,85,{"rth":0.999,"pre":0.001,"post":0,"night":0,"wknd":0},{"rth":[86,253]},[86,253,0.535],[-1,1793376639069,72]],"0x7717a7a245d9f950e586822b8c9b46863ed7bd7e":["B",37,1793371746731,1793377799776,17023,312,0.417,1,null,null,0,null,0,0,null,0,0,0,0,0,0,null,null,null,0,0,0,null,0,0,0,0,0,null,0,0,0,{"rth":1,"pre":0,"post":0,"night":0,"wknd":0},{},[0,0,null],[-1,1793371746731,22]],"0xb45bacc19c5f71ca8ba4134b0bbe6f4a1e9a5b11":["B",261,1793151785898,1793367184507,582132,6161,0,1,null,null,0,null,0,0,null,0,0,0,0,0,0,null,null,null,0,0,0,null,0,0,0,0,0,null,0,0,0,{"rth":0.114,"pre":0.077,"post":0.409,"night":0.401,"wknd":0},{},[0,0,null],[1,1793304161440,82]],"0x1886d6d9b05f11e9db19ba6f84811bb80d4c6582":["B",103,1792090837072,1793365989037,1018785,46734,0.999,0,null,null,5,1,9347,0,null,24236,11.61,0,5,0,46734,null,1,1342,0.8,102000,303000,0.75,4,0.8,23,29,24236,1,1,0.6,0,{"rth":0.375,"pre":0.363,"post":0.102,"night":0.157,"wknd":0.003},{"rth":[2,11492],"post":[1,10995],"wknd":[1,11.61],"pre":[1,24236]},[5,46734,1],null],"0xda411866ef8da115945db1c4987f44cb02c5d3f1":["W",972,1790142711228,1793374719504,42375001,-1767191,0.554,0,null,null,7,0.286,36865,368180,0.04,71094,-1031909,7,0,-1767168,0,0.286,null,6072,0.857,1950000,6572000,1,5,1,164,501,-1543737,0.25,4,1,0,{"rth":0.432,"pre":0.201,"post":0.14,"night":0.193,"wknd":0.033},{"night":[2,-582921],"pre":[2,-960815],"rth":[1,2637],"wknd":[1,-156604],"post":[1,-69464]},[6,-1370782,0.333],[1,1793374449424,51]],"0x4bcc092a156905788bf2a1a59e5968623957210d":["W",2938,1793318504438,1793377819656,20190134,-76932,0.915,1,null,null,13,0.692,573,87.697,14.706,2822,-164,6,7,563,4245,1,0.429,0.822,0,40292,325869,0.462,13,0.846,85,87,4540,0.75,8,0.769,13,{"rth":0.605,"pre":0.166,"post":0,"night":0.229,"wknd":0},{"pre":[3,479],"rth":[10,4329]},[13,4808,0.692],[1,1793367722272,640]],"0xd52936fa285cfa500440e31355c0b28f4b740729":["W",13846,1793306055585,1793378087807,28482897,-9486,0.015,1,null,null,590,0.386,17.97,36.335,0.311,549,-7706,295,295,-8612,-444,0.39,0.383,0.258,0.002,8797,208934,0.501,561,0.749,3085,2906,-9222,0.307,309,0.615,590,{"rth":0.163,"pre":0.314,"post":0.232,"night":0.29,"wknd":0},{"post":[5,-7715],"night":[231,258],"pre":[199,-866],"rth":[155,-733]},[590,-9056,0.386],[1,1793371133962,506]],"0xfd4224606069dd88fec92093a27591008263fda5":["W",671,1793285248940,1793378109850,3976216,43709,0,1,null,null,0,null,0,0,null,0,0,0,0,0,0,null,null,null,0,0,0,null,0,0,0,0,0,null,0,0,0,{"rth":0.23,"pre":0.18,"post":0.252,"night":0.339,"wknd":0},{},[0,0,null],[1,1793309354107,255]],"0xe724acd020fbd65ddb42a0f05dcfb65489480320":["W",204,1791849875551,1793307029380,9074351,-92550,0.855,0,null,null,13,0.462,11420,23054,0.425,67674,-90456,7,6,-109126,16268,0.286,0.667,806,0.538,34724,997754,0.538,13,0.538,58,14,-93682,0.143,7,0.462,10,{"rth":0.244,"pre":0.11,"post":0.221,"night":0.3,"wknd":0.125},{"night":[1,-1797],"rth":[7,-143177],"wknd":[3,64687],"post":[2,-12571]},[13,-92858,0.462],[1,1793304760509,2]],"0x7f5653978d3f1b9716140bb7304c7e4650ae50f6":["W",753,1788368836414,1793375649650,7763738,-70054,0.529,0,null,null,28,0.321,7760,7363,0.499,23645,-16924,21,7,-73915,3866,0.238,0.571,801,0.571,128120,301427,0.6,20,0.893,157,312,-31570,0.25,12,0.821,0,{"rth":0.464,"pre":0.229,"post":0.098,"night":0.175,"wknd":0.033},{"rth":[12,-62843],"post":[4,-13653],"night":[6,-14223],"pre":[4,1316],"wknd":[2,19354]},[20,-91830,0.2],[1,1793375615093,1]],"0xfc667adba8d4837586078f4fdcdc29804337ca06":["W",818,1793359018028,1793378130634,1770900,-10335,0.904,1,null,null,0,null,0,0,null,0,0,0,0,0,0,null,null,null,0,0,0,null,0,0,0,0,0,null,0,0,0,{"rth":0.743,"pre":0.257,"post":0,"night":0,"wknd":0},{},[0,0,null],[-1,1793361018291,710]],"0x25773676902085225ae5751075e4161369334897":["W",400,1793371384820,1793378290939,4351574,6846,0.407,1,null,null,10,0.6,818,180,6.798,4343,-508,5,5,-713,4898,0.2,1,4.136,0,145369,459545,0.5,10,1,89,19,3803,0.5,6,1,10,{"rth":1,"pre":0,"post":0,"night":0,"wknd":0},{"rth":[10,4184]},[10,4184,0.6],[1,1793376690754,22]],"0xe9ffe7698f46f96f980f2877e18c43f5b4165903":["W",614,1792719300573,1793319057920,1786205,13836,0.376,1,null,null,12,0.5,30.965,929,0.033,82.608,-3131,5,7,-3179,-2209,0.6,0.429,3.65,0.083,10544,108147,0.667,12,0.583,28,49,-5457,0.2,5,0.333,1,{"rth":0.116,"pre":0.282,"post":0.148,"night":0.427,"wknd":0.027},{"post":[4,-3523],"rth":[3,89.699],"night":[5,-1955]},[12,-5388,0.5],null],"0x7cee351d68e21f2bf1adf8161bd1598a80d6fc93":["W",226,1793353502965,1793378287686,221393,-55307,0,1,null,null,0,null,0,0,null,0,0,0,0,0,0,null,null,null,0,0,0,null,0,0,0,0,0,null,0,0,0,{"rth":0.977,"pre":0.023,"post":0,"night":0,"wknd":0},{},[0,0,null],[1,1793353502965,12]],"0xf1e79e5cf063073deec9a0d86c178f7cde84d479":["W",11,1793378303774,1793378665656,545,-137,0.09,0,-137,-221331,0,null,0,0,null,0,0,0,0,0,0,null,null,null,0,0,0,null,0,0,0,0,0,null,0,0,0,{"rth":1,"pre":0,"post":0,"night":0,"wknd":0},{},[0,0,null],[1,1793378303774,0]],"0xb28bdcb4c7db9370b73f6dbd57671416a0a57dd6":["W",9,1791197166569,1792364509252,80320,7.095,0,0,7.095,-110181,0,null,0,0,null,0,0,0,0,0,0,null,null,null,0,0,0,null,0,0,0,0,0,null,0,0,0,{"rth":0,"pre":0.004,"post":0,"night":0,"wknd":0.996},{},[0,0,null],[1,1791197166569,8]],"0xc473eeadb5c500b010f6f882f922a394af09302a":["W",264,1786314235436,1793378080448,9499640,-23901,0.004,0,-23901,-31458,40,0.825,1042,4625,1.062,10272,-25768,29,11,108,1904,0.862,0.727,148,0.275,37523,368000,0.857,35,0.5,92,5,-13518,0.778,18,0.275,0,{"rth":0.416,"pre":0.172,"post":0.062,"night":0.215,"wknd":0.135},{"wknd":[3,7355],"night":[10,11530],"pre":[6,-708],"rth":[20,-16556],"post":[1,391]},[19,-862,0.789],[1,1793222611782,19]],"0xa4dedda59f2908b92ae192cfd494839373bcb3c4":["W",67,1792178356677,1793375292554,27881932,14637,0,0,14637,-38510,5,0.6,12447,11299,1.652,18007,-22308,5,0,14741,0,0.6,null,13.422,0,2405602,3771646,1,5,1,6,18,-17851,0.333,3,1,0,{"rth":0.39,"pre":0,"post":0.396,"night":0.086,"wknd":0.127},{"rth":[2,-4302],"wknd":[1,14586],"post":[2,4457]},[5,14741,0.6],[1,1793375263477,5]],"0x6ba2ad09aa6629a423b59b71f3564d84ce66c001":["W",137,1793372212870,1793378797314,105393,-3642,0.657,0,-3642,-18389,0,null,0,0,null,0,0,0,0,0,0,null,null,null,0,0,0,null,0,0,0,0,0,null,0,0,0,{"rth":1,"pre":0,"post":0,"night":0,"wknd":0},{},[0,0,null],[1,1793372212870,101]],"0xbeccae9ffcb69e9d42a1d4e744abf8056149562d":["W",19,1793374059642,1793378741428,46766,-2057,0.743,0,-2057,-16111,0,null,0,0,null,0,0,0,0,0,0,null,null,null,0,0,0,null,0,0,0,0,0,null,0,0,0,{"rth":1,"pre":0,"post":0,"night":0,"wknd":0},{},[0,0,null],[1,1793374059642,11]],"0xc3b27ac6b2e45b2b50e67fc805f7b2aac263daee":["W",602,1788109702560,1793378826934,1368490,-424,0.338,0,-424,-6404,8,0.625,1381,1876,1.227,5181,-5345,8,0,1278,0,0.625,null,4160,0.75,40005,101874,1,4,1,220,59,1336,0.714,7,0.875,0,{"rth":0.477,"pre":0.084,"post":0.029,"night":0.035,"wknd":0.374},{"wknd":[2,29.635],"pre":[1,5181],"night":[1,19.547],"rth":[3,-4326],"post":[1,373]},[7,1025,0.571],[1,1793308539472,60]],"0x2dbc53fe4683a9308feb5cd88ab10d73ad220b3d":["W",169,1793376642529,1793378732096,29987,-3611,0,0,-3611,-2588,0,null,0,0,null,0,0,0,0,0,0,null,null,null,0,0,0,null,0,0,0,0,0,null,0,0,0,{"rth":1,"pre":0,"post":0,"night":0,"wknd":0},{},[0,0,null],[1,1793376642529,45]],"0xc06dd151c27dbe535ae95797e8aab1bb8b8cc7c0":["W",70,1793213815249,1793378107072,266004,-3702,1,0,-3702,554,4,0.5,180,2236,0.081,206,-4471,2,2,-4471,361,0,1,121,0.25,10511,64440,0.75,4,0.5,13,1,-4471,0,2,0.25,4,{"rth":0.272,"pre":0.171,"post":0.422,"night":0.135,"wknd":0},{"rth":[3,361],"post":[1,-4471]},[4,-4110,0.5],[-1,1793367001353,0]],"0xb1bfb0476bcdfc7989250e606312e6d716c11706":["W",187,1788876557243,1793378512312,828888,-1510,0,0,-1510,-5.533,49,0.306,177,122,0.637,1030,-1017,28,21,-1595,86.863,0.321,0.286,69.558,0.204,5516,40839,0.475,40,0.265,7,16,-1649,0.143,7,0.429,0,{"rth":0.397,"pre":0.358,"post":0.007,"night":0.18,"wknd":0.059},{"rth":[27,-116],"post":[2,-76.205],"pre":[9,-1697],"night":[6,-261],"wknd":[5,642]},[12,398,0.333],[1,1793378512312,0]]};
  function mkTraits(P){
  const usd=x=>{const a=Math.abs(x),s=x<0?"−":"";return s+(a>=1e6?"$"+(a/1e6).toFixed(2)+"M":a>=1e3?"$"+(a/1e3).toFixed(1)+"K":"$"+Math.round(a))};
  const pct=x=>x==null?"--":Math.round(x*100)+"%";
  const hold=m=>m==null?"--":m<90?Math.round(m)+" min":m<2880?(m/60).toFixed(1)+" h":(m/1440).toFixed(1)+" days";
  const SN={rth:"the regular session",pre:"pre-market",post:"after-hours",night:"overnight",wknd:"weekends"};
  const day=t=>new Date(t).toLocaleDateString("en-US",{timeZone:"America/New_York",month:"short",day:"numeric"});
  const out={};
  for(const a in P){const p=P[a];
   if(!p.n){out[a]={span:"no SOXL fills in the available history",tags:[["No recent SOXL trades",""]],st:{},works:[],fails:[],tend:[],use:"Not enough data."};continue}
   const g=p.g,T=[],works=[],fails=[],tend=[],n=p.trips,small=n<8,lim=p.limited;
   const span=`${day(p.from)} – ${day(p.to)} · ${p.n.toLocaleString()} fills · ${n} round trips${lim?" · history cut by the API":""}${small?" (small sample)":""}`;
   const hm=p.holdMed;
   if(hm!=null)T.push([hm<30?"Scalper":hm<360?"Day trader":hm<4320?"Swing trader":"Position trader",""]);
   const L=p.longN,S=p.shortN;
   if(S>1.8*Math.max(L,1)&&S>=3)T.push(["Mostly short",""]);else if(L>1.8*Math.max(S,1)&&L>=3)T.push(["Mostly long",""]);else if(n>=4)T.push(["Trades both sides",""]);
   const c=p.contra;if(c!=null&&p.ctrN>=6){if(c>=0.62)T.push(["Buys dips / sells rips",""]);else if(c<=0.38)T.push(["Momentum chaser",""])}
   if(p.addShare>=0.35&&p.avgDown>p.avgUp*1.2&&p.avgDownN>=3)T.push(["Averages down",p.avgDownP>0?"g":"b"]);else if(p.avgUp>p.avgDown*1.2&&p.avgUp>=3)T.push(["Adds to winners",g==="B"?"g":""]);
   if(p.scaleOut>=0.5&&n>=4)T.push(["Scales out",""]);
   if(p.maker>=0.6)T.push(["Limit orders",""]);else if(p.maker<=0.2)T.push(["Market orders",""]);
   const s=p.sess;if((s.night||0)+(s.wknd||0)>=0.3)T.push(["Night / weekend",""]);else if((s.pre||0)+(s.post||0)>=0.3)T.push(["Extended hours",""]);
   const aw=p.avgW,al=p.avgL;
   if(n>=5&&al>2*aw&&(p.wr||0)>=0.5)T.push(["Small wins, big losses","b"]);else if(n>=5&&aw>2*Math.max(al,1))T.push(["Cuts losers fast","g"]);
   if((p.sizeMed||0)>=500000||(n===0&&p.open&&p.vol>=2e6))T.push(["Big size",""]);
   if(p.flips>=3&&p.flips>=0.2*Math.max(n,1)&&n>=5)T.push(["Flips side",""]);
   if(p.overShare>=0.5&&n>=4)T.push(["Holds overnight",""]);
   if(n===0&&p.open){T.push([`Building a ${p.open.side>0?"long":"short"}`,p.open.side>0?"g":"b"]);}
   const lp=p.longP,sp=p.shortP;
   if(L&&S){const bl=lp>sp?"long":"short",wl=bl==="long"?"short":"long",bp=Math.max(lp,sp),wp=Math.min(lp,sp);
     if(bp>0)works.push(`${bl[0].toUpperCase()+bl.slice(1)} trades: ${usd(bp)} net, ${pct(p[bl+"WR"])} won (${p[bl+"N"]} trades)`);
     if(wp<0)fails.push(`${wl[0].toUpperCase()+wl.slice(1)} trades: ${usd(wp)} net, ${pct(p[wl+"WR"])} won (${p[wl+"N"]} trades)`);else if(wp>0)works.push(`${wl[0].toUpperCase()+wl.slice(1)} trades also pay: ${usd(wp)} net`)}
   else if(L||S){const side=L?"long":"short",v=L?lp:sp;(v>0?works:fails).push(`Only ${side} trades: ${usd(v)} net, ${pct(p[side+"WR"])} won`)}
   const bs=Object.entries(p.bySess).filter(([k,v])=>v.n>=2).sort((x,y)=>x[1].p-y[1].p);
   if(bs.length){const top=bs[bs.length-1];if(top[1].p>0)works.push(`Entries in ${SN[top[0]]}: ${usd(top[1].p)} over ${top[1].n} trades`);if(bs[0][1].p<0&&bs[0]!==top)fails.push(`Entries in ${SN[bs[0][0]]}: ${usd(bs[0][1].p)} over ${bs[0][1].n} trades`)}
   if(p.avgDownN>=2)(p.avgDownP>0?works:fails).push(`Adding to a losing position: ${usd(p.avgDownP)} over ${p.avgDownN} trades (${pct(p.avgDownWR)} won)`);
   if(n>=3){if(al>2*aw&&al>0)fails.push(`Average loss ${usd(-al)} is ${(al/Math.max(aw,1)).toFixed(1)}× the average win ${usd(aw)}: losers run too long`);else if(aw>1.5*al&&aw>0)works.push(`Average win ${usd(aw)} vs average loss ${usd(-al)}: lets winners run`);
     if(p.worst<0&&Math.abs(p.worst)>0.4*Math.max(Math.abs(p.pnl),1))fails.push(`One trade lost ${usd(p.worst)}: a large part of the total`);
     if(p.best>0&&p.pnl>0&&p.best>0.5*p.pnl)works.push(`Best trade made ${usd(p.best)}: most of the profit came from a few big trades`)}
   const r=p.rec;if(r.n>=2)(r.p>0?works:fails).push(`Last 30 days: ${usd(r.p)} over ${r.n} trades (${pct(r.wr)} won)`);
   if(n===0&&p.open)tend.push(`No closed trade in the available fills: it is building one ${p.open.side>0?"long":"short"} (${p.open.adds} adds since ${day(p.open.since)})`);
   if(hm!=null)tend.push(`Median hold ${hold(hm)}; ${pct(p.overShare)} of trades held past the end of the day`);
   if(c!=null&&p.ctrN>=4)tend.push(`${pct(c)} of entries go against the 4-hour move before them (${c>=0.5?"buys after drops, shorts after rises":"buys after rises, shorts after drops"})`);
   const main=Object.keys(s).sort((x,y)=>s[y]-s[x])[0];tend.push(`Most volume in ${SN[main]} (${pct(s[main])}); ${pct(p.maker)} with resting limit orders`);
   if(p.addShare>0)tend.push(`Adds to ${pct(p.addShare)} of positions (${p.avgDown} adds while losing, ${p.avgUp} while winning); scales out of ${pct(p.scaleOut)}`);
   if(n>0)tend.push(`Median size ${usd(p.sizeMed||0)}, largest ${usd(p.sizeMax)}`);
   if(p.realized!=null)tend.push(`SOXL result in these fills: ${usd(p.realized)} realized${p.unreal?`, ${usd(p.unreal)} open`:""}`);
   let use;
   if(g==="B"){const strong=n?(lp>=sp?"long":"short"):(p.open&&p.open.side>0?"long":"short");
     use=n?`Weight its ${strong} entries more than its ${strong==="long"?"short":"long"} entries.`:`Follow its current ${strong} build-up: watch the adds in the move list.`;
     if(T.some(t=>t[0]==="Averages down"))use+=" It averages down: a first entry is often not its final price.";
     use+=hm!=null&&hm<360?" Short holds: its moves are signals for minutes to hours, not days.":hm!=null?" Long holds: its moves are signals for days.":"";}
   else{const weak=n?(lp<=sp?"long":"short"):(p.open&&p.open.side>0?"long":"short");use=`A losing wallet: its ${weak} entries are the best ones to fade.`+(T.some(t=>t[0]==="Small wins, big losses")||al>2*aw?" It lets losers run, so its forced exits can mark the end of a move.":"")}
   if(small)use+=" Small sample: use with care.";
   const st={trips:n,wr:pct(p.wr),avgW:usd(aw),avgL:al?usd(-al):"$0",pf:p.pf?p.pf.toFixed(2):(aw>0?"∞":"--"),hold:hold(hm),size:usd(p.sizeMed||0),ls:`${L} / ${S}`,lp:usd(lp),sp:usd(sp),r30:`${usd(r.p)} (${r.n})`,mk:pct(p.maker)};
   out[a]={span,tags:T,st,works:works.slice(0,4),fails:fails.slice(0,4),tend:tend.slice(0,6),use};
  }
  return out}
  const PROF = (() => { const K = ["g","n","from","to","vol","pnl","maker","limited","realized","unreal","trips","wr","avgW","avgL","pf","best","worst","longN","shortN","longP","shortP","longWR","shortWR","holdMed","overShare","sizeMed","sizeMax","contra","ctrN","addShare","avgDown","avgUp","avgDownP","avgDownWR","avgDownN","scaleOut","flips"], P = {};
    for (const a in STATS) { const r = STATS[a]; if (!r[1]) { P[a] = { g: r[0], n: 0 }; continue; }
      const p = {}; K.forEach((k, i) => p[k] = r[i]); p.limited = !!p.limited; p.sess = r[K.length]; p.bySess = Object.fromEntries(Object.entries(r[K.length + 1]).map(([k, v]) => [k, { n: v[0], p: v[1] }]));
      p.rec = { n: r[K.length + 2][0], p: r[K.length + 2][1], wr: r[K.length + 2][2] }; const o = r[K.length + 3]; p.open = o ? { side: o[0], since: o[1], adds: o[2] } : null; P[a] = p; }
    try { return mkTraits(P); } catch (e) { console.warn("profiles", e); return {}; } })();
  const COIN = "xyz:SOXL", DEX = "xyz", API = "https://api.hyperliquid.xyz/info";
  const MIN_EV = 50000;          // position changes smaller than $50K do not make an event
  const MIN_MOVE = 10000;        // top-trader moves smaller than $10K are not shown in the top 3
  const GAP = 15 * 60000;        // fills closer than this join the same move
  const card = $("whaleCard"); if (!card) return;

  const css = `
#whaleCard .wwtabs{display:flex;gap:4px;flex-wrap:wrap}
.wwp{display:inline-block;font-size:10px;padding:1px 6px;border-radius:99px;text-transform:uppercase;letter-spacing:.05em;font-weight:600}
.wwp.l{background:color-mix(in srgb,var(--up) 18%,transparent);color:var(--up)}.wwp.s{background:color-mix(in srgb,var(--down) 18%,transparent);color:var(--down)}
.wwp.f{background:var(--panel2);color:var(--dim)}
#whaleCard .wwch{font-size:11px;white-space:nowrap}
#whaleCard .wwev{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 12px;font-size:13px;margin-top:6px}
#whaleCard .wwev .t{font-family:var(--mono);font-size:11px;color:var(--dim);white-space:nowrap}
.wwhot{color:var(--amber)}
#whaleCard .wwnote{font-size:12px;color:var(--dim);margin-top:8px}
.wwtop{display:flex;flex-direction:column;gap:8px;min-width:0}
.wwtop .hd{display:flex;justify-content:space-between;gap:8px;align-items:baseline;flex-wrap:wrap}
.wwtop .hd .label{margin:0}
.wwm{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:4px 10px;align-items:center;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:var(--panel2)}
.wwm.new{border-color:var(--amber);box-shadow:0 0 0 1px color-mix(in srgb,var(--amber) 40%,transparent)}
.wwm .rk{font-family:var(--mono);font-weight:600;font-size:13px;padding:3px 7px;border-radius:8px;background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--accent);white-space:nowrap}
.wwm .tx{font-size:13px;line-height:1.35;min-width:0}.wwm .tx b.s{color:var(--down)}.wwm .tx b.l{color:var(--up)}
.wwm .tx .sub{font-family:var(--mono);font-size:11px}
.wwm .ag{font-family:var(--mono);font-size:12px;color:var(--dim);text-align:right;white-space:nowrap}
.wwtag{display:inline-block;font-size:10px;padding:1px 6px;border-radius:99px;border:1px solid var(--line);color:var(--dim);margin:1px 3px 1px 0;white-space:nowrap}
.wwtag.g{border-color:color-mix(in srgb,var(--up) 50%,transparent);color:var(--up)}.wwtag.b{border-color:color-mix(in srgb,var(--down) 50%,transparent);color:var(--down)}
#whaleCard tr.wwr{cursor:pointer}#whaleCard tr.wwr:hover td{background:color-mix(in srgb,var(--accent) 6%,transparent)}
.wwpf{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}
.wwpc{border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--panel2);font-size:13px;line-height:1.45;min-width:0}
.wwpc h5{margin:0 0 4px;font-family:var(--mono);font-size:13px;display:flex;justify-content:space-between;gap:6px}
.wwpc .kv{display:grid;grid-template-columns:auto auto auto auto;gap:2px 10px;font-family:var(--mono);font-size:11px;margin:6px 0}
.wwpc ul{margin:4px 0 0;padding-left:16px}.wwpc li{margin:1px 0}
.wwpc .w{color:var(--up)}.wwpc .x{color:var(--down)}.wwpc .t{color:var(--dim)}
td.wwdet{white-space:normal!important;text-align:left!important;background:var(--panel2)}
#whaleCard .chipb{font-size:11px;padding:4px 9px;border-radius:99px}
.wwstar{cursor:pointer;color:var(--mute);font-size:15px}.wwstar.on{color:var(--amber)}
#whaleCard tr.wwst td{background:color-mix(in srgb,var(--amber) 7%,transparent)}
.wwm.st{border-color:var(--amber)}
.wwage.bad{color:var(--down)}.wwage.ok{color:var(--dim)}
`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  // ---------- state ----------
  const W = {}; LIST.forEach(([a, g, pnl, tr, wr, coh], i) => { W[a] = { a, g, pnl, tr, wr, coh, rank: g === "B" ? i + 1 : i - 19, pos: null }; });
  const NB = LIST.filter(x => x[1] === "B").length, NW = LIST.length - NB;
  const load = (k, d) => { try { return JSON.parse(lsGet(k) || "null") || d; } catch (e) { return d; } };
  let anchor = load("soxx_ww_anchor", {});      // worst wallets: size at the last event
  let EV = load("soxx_ww_ev", []);              // worst-wallet events
  let MV = load("soxx_ww_mv", []);              // top-trader moves (from fills)
  let CUR = load("soxx_ww_cur", {});
  const ORD = {};
  let RZ = load("soxx_ww_rz", {});              // top wallets: realized SOXL P&L since the study (fills after Oct 28, 2026)
  let STAR = load("soxx_ww_star", {});          // starred wallets
  let RK = load("soxx_ww_rk", { d: "", prev: {} }); // live ranks at the start of the day (to show the move)
  let rkBy = lsGet("soxx_ww_rkby2") || "smart", onlyStar = false;
  const STUDY_T = Date.parse("2026-10-29T00:00:00Z");                                // per wallet: open SOXL orders {at, list}            // per wallet: time of the newest fill we have
  let tryAt = 0, mark = NaN, lastAt = 0, fillAt = 0, err = "", tab = "B", busy = 0, limited = 0;
  const short = a => a.slice(0, 6) + "…" + a.slice(-4);
  const usd = x => { const a = Math.abs(x); return (x < 0 ? "−" : "") + "$" + (a >= 1e6 ? (a / 1e6).toFixed(2) + "M" : a >= 1e3 ? (a / 1e3).toFixed(1) + "K" : Math.round(a)); };
  const sh = x => Math.round(Math.abs(x)).toLocaleString("en-US");
  const agoT = t => { const s = Math.max(0, Math.round((Date.now() - t) / 1000)); return s < 60 ? s + "s ago" : s < 3600 ? Math.round(s / 60) + " min ago" : s < 86400 ? (s / 3600).toFixed(1) + " h ago" : Math.round(s / 86400) + " d ago"; };
  const clock = t => new Date(t).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  async function hl(body) {
    const c = new AbortController(), to = setTimeout(() => c.abort(), 12000);
    try {
      const r = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: c.signal });
      if (r.status === 429) { limited = Date.now(); throw new Error("Hyperliquid rate limit"); }
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } finally { clearTimeout(to); }
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const save = () => { try { lsSet("soxx_ww_anchor", JSON.stringify(anchor)); lsSet("soxx_ww_ev", JSON.stringify(EV.slice(0, 40))); lsSet("soxx_ww_mv", JSON.stringify(MV.slice(0, 300))); lsSet("soxx_ww_cur", JSON.stringify(CUR)); lsSet("soxx_ww_rz", JSON.stringify(RZ)); lsSet("soxx_ww_star", JSON.stringify(STAR)); lsSet("soxx_ww_rk", JSON.stringify(RK)); } catch (e) { } };

  // ---------- top-trader fills → moves ----------
  function kindOf(f) {
    const s0 = +f.startPosition, d = f.dir || "", q = +f.sz * (f.side === "B" ? 1 : -1), s1 = s0 + q;
    if (/Long > Short|Short > Long/.test(d)) return { k: "flip", side: s1 > 0 ? "long" : "short" };
    if (/Open Long/.test(d)) return { k: Math.abs(s0) > 1e-9 ? "add" : "open", side: "long" };
    if (/Open Short/.test(d)) return { k: Math.abs(s0) > 1e-9 ? "add" : "open", side: "short" };
    if (/Close Long/.test(d)) return { k: Math.abs(s1) < 1e-9 ? "close" : "cut", side: "long" };
    if (/Close Short/.test(d)) return { k: Math.abs(s1) < 1e-9 ? "close" : "cut", side: "short" };
    return null;
  }
  function ingest(a, fills) {
    fills = fills.filter(f => f.coin === COIN).sort((x, y) => x.time - y.time);
    for (const f of fills) {
      const t = +f.time; if (CUR[a] && t <= CUR[a].t && CUR[a].tids && CUR[a].tids.includes(f.tid)) continue;
      const kd = kindOf(f); if (!kd) continue;
      const px = +f.px, q = +f.sz * (f.side === "B" ? 1 : -1), s1 = +f.startPosition + q;
      if (t >= STUDY_T) RZ[a] = (RZ[a] || 0) + (+f.closedPnl || 0) - (+f.fee || 0);
      // join the last move of this wallet when it is the same action and side, and close in time
      const grp = kd.k === "open" || kd.k === "add" ? "grow" : kd.k === "cut" || kd.k === "close" ? "shrink" : "flip";
      const m = MV.find(x => x.a === a);
      if (m && m.grp === grp && m.side === kd.side && t - m.t1 <= GAP && grp !== "flip") {
        m.sz += Math.abs(q); m.usd += Math.abs(q) * px; m.t1 = t; m.end = s1; m.k = m.k === "open" ? "open" : kd.k === "close" ? "close" : m.k;
        if (kd.k === "close") m.k = "close";
        m.px = m.usd / m.sz; m.n = (m.n || 1) + 1; m.fresh = Date.now();
      } else {
        MV.unshift({ a, grp, k: kd.k, side: kd.side, sz: Math.abs(q), usd: Math.abs(q) * px, px, t0: t, t1: t, start: +f.startPosition, end: s1, n: 1, fresh: Date.now() });
      }
    }
    if (fills.length) { const t = fills[fills.length - 1].time; CUR[a] = { t, tids: fills.filter(f => f.time === t).map(f => f.tid) }; }
    MV.sort((x, y) => y.t1 - x.t1); MV = MV.slice(0, 300);
  }
  const verb = m => m.k === "flip" ? `flipped to <b class="${m.side === "long" ? "l" : "s"}">${m.side}</b>` :
    m.k === "open" ? `opened a <b class="${m.side === "long" ? "l" : "s"}">${m.side}</b>` :
    m.k === "add" ? `added to the <b class="${m.side === "long" ? "l" : "s"}">${m.side}</b>` :
    m.k === "cut" ? `cut the <b class="${m.side === "long" ? "l" : "s"}">${m.side}</b>` : `closed the <b class="${m.side === "long" ? "l" : "s"}">${m.side}</b>`;
  const moveTxt = (m, P) => `${verb(m)} · ${m.grp === "shrink" ? (m.side === "long" ? "sold" : "bought back") : m.side === "long" ? "bought" : "sold"} ${usd(m.usd)} (${sh(m.sz)} sh) at ${fmtPx(m.px)}${m.n > 1 ? ` in ${m.n} orders over ${Math.max(1, Math.round((m.t1 - m.t0) / 60000))} min` : ""} · now ${Math.abs(m.end) < 1e-9 ? "flat" : (m.end > 0 ? "long " : "short ") + usd(Math.abs(m.end) * (P > 0 ? P : m.px))}`;
  const plain = s => s.replace(/<[^>]+>/g, "");
  const moveAlerted = {};
  function moveAlerts(P) {
    for (const m of MV.slice(0, 40)) {
      if (STAR[m.a] && m.usd >= 5000 && Date.now() - m.t1 <= 2 * 3600000) { const w = W[m.a], key = `wws:${m.a}:${m.t0}:${Math.floor(m.usd / 25000)}`;
        if (w && !moveAlerted[key]) { moveAlerted[key] = 1; try { alert1(key, 864e5, `★ Starred ${w.g === "B" ? "top" : "worst"} #${w.rank} ${plain(moveTxt(m, P))} · ${agoT(m.t1)}`, FUND, true); } catch (e) { } } }
      if (m.usd < MIN_EV || Date.now() - m.t1 > 2 * 3600000) continue;
      const w = W[m.a]; if (!w) continue;
      const step = Math.floor((m.usd - MIN_EV) / 100000), key = `wwm:${m.a}:${m.t0}:${step}`;
      if (moveAlerted[key]) continue; moveAlerted[key] = 1;
      try { alert1(key, 864e5, `🐋 Top #${w.rank} SOXL trader (${usd(w.pnl)} on SOXL) ${plain(moveTxt(m, P))} · ${agoT(m.t1)}`, FUND, w.rank <= 10 || m.k === "flip" || m.k === "open"); } catch (e) { }
    }
  }

  // ---------- polling: every minute, also in a background tab ----------
  async function pollFills() {
    const best = Object.values(W).filter(w => w.g === "B").sort((x, y) => x.rank - y.rank);
    let inits = 0, ok = 0;
    for (const w of best) {
      if (Date.now() - limited < 60000) break;
      try {
        const c = CUR[w.a];
        if (!c || Date.now() - c.t > 3 * 86400000) {
          if (inits >= 6) continue;          // first load: newest 2000 fills, at most 6 wallets per minute (rate limit)
          inits++; const f = await hl({ type: "userFills", user: w.a, aggregateByTime: true });
          try { window.wwRawFills && window.wwRawFills(w.a, f || [], true); } catch (e) { }   // all coins, for the spot study (intel.js)
          ingest(w.a, (f || []).filter(x => x.coin === COIN)); if (!CUR[w.a]) CUR[w.a] = { t: Date.now() - 3 * 86400000 + 60000, tids: [] };
        } else {
          const f = await hl({ type: "userFillsByTime", user: w.a, startTime: c.t, aggregateByTime: true });
          try { window.wwRawFills && window.wwRawFills(w.a, f || [], false); } catch (e) { }
          ingest(w.a, f || []);
          if (f && f.length >= 2000) CUR[w.a] = { t: Math.max(c.t, f[f.length - 1].time), tids: [] }; // more to read next minute
        }
        ok++;
      } catch (e) { if (limited) break; }
      await sleep(80);
    }
    if (ok) fillAt = Date.now();
  }
  async function pollOrders() {
    const pend = Object.values(W).filter(w => w.g === "B" && !CUR[w.a]).length;
    const L = Object.values(W).sort((x, y) => ((ORD[x.a] || {}).at || 0) - ((ORD[y.a] || {}).at || 0)).slice(0, pend ? 4 : 15);
    for (const w of L) {
      if (Date.now() - limited < 60000) break;
      try {
        const o = await hl({ type: "frontendOpenOrders", user: w.a, dex: DEX });
        const prev = ORD[w.a];
        ORD[w.a] = { at: Date.now(), list: (o || []).filter(x => x.coin === COIN).map(x => ({ oid: x.oid, side: x.side === "B" ? 1 : -1, px: +(x.isTrigger ? x.triggerPx : x.limitPx) || +x.limitPx, sz: +x.sz, osz: +x.origSz || +x.sz, ro: !!x.reduceOnly || !!x.isPositionTpsl, trig: !!x.isTrigger, type: x.orderType || "", cond: x.triggerCondition || "", t: x.timestamp })) };
        if (prev) orderChanges(w, prev.list, ORD[w.a].list);
      } catch (e) { if (limited) break; }
      await sleep(60);
    }
  }
  // ---------- order changes: a tracked wallet moves an order's price, changes its size, or cancels and replaces it ----------
  function orderChanges(w, A, Bn) {
    const P = mark > 0 ? mark : (Q[FUND] && Q[FUND].c) || NaN, min = STAR[w.a] ? 5000 : 15000, out = [];
    const nm = o => `${o.side > 0 ? "buy" : "sell"} ${o.trig ? (o.type || "trigger").toLowerCase() : "limit"}${o.ro ? " (reduce-only)" : ""}`;
    const val = o => o.sz * (o.px || P), byA = new Map(A.filter(o => o.oid != null).map(o => [o.oid, o])), byB = new Map(Bn.filter(o => o.oid != null).map(o => [o.oid, o]));
    // same order id: price moved or size changed (a size drop with the same original size is a partial fill, not a change)
    for (const [id, o1] of byB) { const o0 = byA.get(id); if (!o0) continue;
      const dp = o0.px && o1.px ? o1.px / o0.px - 1 : 0, sizeChg = o1.osz !== o0.osz;
      if (Math.abs(dp) >= 0.0005 && Math.max(val(o0), val(o1)) >= min) out.push({ k: "move", txt: `moved a ${usd(val(o1))} ${nm(o1)} ${fmtPx(o0.px)} → ${fmtPx(o1.px)} (${dp > 0 ? "+" : ""}${(dp * 100).toFixed(2)}%)` });
      else if (sizeChg && Math.max(val(o0), val(o1)) >= min) out.push({ k: "size", txt: `${o1.osz > o0.osz ? "raised" : "cut"} a ${nm(o1)} @ ${fmtPx(o1.px)} from ${usd(val(o0))} to ${usd(val(o1))}` }); }
    // cancel + replace: an order gone and a new one of the same kind in the same poll
    const gone = A.filter(o => !byB.has(o.oid)), born = Bn.filter(o => !byA.has(o.oid)), used = new Set();
    gone.forEach(o0 => { const j = born.findIndex((o1, i) => !used.has(i) && o1.side === o0.side && o1.trig === o0.trig && o1.ro === o0.ro); 
      if (j >= 0) { used.add(j); const o1 = born[j]; if (Math.max(val(o0), val(o1)) < min) return; const dp = o0.px && o1.px ? o1.px / o0.px - 1 : 0;
        out.push({ k: "replace", txt: `replaced a ${nm(o0)}: ${usd(val(o0))} @ ${fmtPx(o0.px)} → ${usd(val(o1))} @ ${fmtPx(o1.px)}${Math.abs(dp) >= 0.0005 ? ` (${dp > 0 ? "+" : ""}${(dp * 100).toFixed(2)}%)` : ""}` }); }
      else if (val(o0) >= min * 2) out.push({ k: "pull", txt: `pulled a ${usd(val(o0))} ${nm(o0)} @ ${fmtPx(o0.px)} (cancelled or filled)` }); });
    born.forEach((o1, i) => { if (!used.has(i) && val(o1) >= min * 2) out.push({ k: "place", txt: `placed a ${usd(val(o1))} ${nm(o1)} @ ${fmtPx(o1.px)}${isFinite(P) ? ` (${((o1.px / P - 1) * 100).toFixed(2)}% from mark)` : ""}` }); });
    const now = Date.now();
    out.slice(0, 4).forEach(e => {
      EV.unshift({ t: now, a: w.a, g: w.g, k: "ord", txt: "orders · " + e.txt, px: P }); EV = EV.slice(0, 60);
      if (e.k === "pull") return;   // a pull can be a fill: shown in Moves, no alert
      try { alert1(`wwo:${w.a}:${e.k}:${now}`, 60000, `${STAR[w.a] ? "★ Starred · " : ""}📝 ${w.g === "B" ? "Top" : "Worst"} #${w.rank} SOXL trader ${e.txt} · $SOXL perp ${fmtPx(P)}${w.g === "W" ? " (a losing wallet)" : ""}`, FUND, false); } catch (x) { }
    });
    if (out.length) { try { save("soxx_ww_ev", EV); } catch (x) { } }
  }

  // what an order does to the wallet's position
  function ordRole(w, o) {
    const pz = w.pos ? w.pos.szi : 0;
    if (o.ro || (pz && Math.sign(o.side) !== Math.sign(pz) && o.sz <= Math.abs(pz) * 1.0001)) return pz > 0 ? "close long" : pz < 0 ? "close short" : "close";
    if (pz && Math.sign(o.side) !== Math.sign(pz)) return "flip";
    return pz ? (pz > 0 ? "add long" : "add short") : (o.side > 0 ? "open long" : "open short");
  }
  function ordAgg(g) {
    const P = mark > 0 ? mark : (Q[FUND] && Q[FUND].c) || NaN, o = { buy: 0, sell: 0, add: 0, close: 0, n: 0, w: 0, stops: 0 };
    Object.values(W).filter(w => w.g === g).forEach(w => { const L = (ORD[w.a] || {}).list || []; if (L.length) o.w++;
      L.forEach(x => { const v = x.sz * (x.px || P); o.n++; if (x.side > 0) o.buy += v; else o.sell += v; const r = ordRole(w, x); if (/close/.test(r)) o.close += v; else o.add += v; if (x.trig) o.stops++; }); });
    return o;
  }
  // liquidation pain: the 1% price band with the most tracked long $ (below) and short $ (above)
  function pain() {
    const P = mark > 0 ? mark : (Q[FUND] && Q[FUND].c) || NaN; if (!isFinite(P)) return null;
    const bins = {}; Object.values(W).forEach(w => { const p = w.pos; if (!p || !p.szi || !p.lq) return; const side = p.szi > 0 ? "L" : "S";
      if ((side === "L" && p.lq >= P) || (side === "S" && p.lq <= P) || Math.abs(p.lq / P - 1) > 0.4) return;
      const b = Math.round(Math.log(p.lq / P) / Math.log(1.01)), k = side + b, x = bins[k] || (bins[k] = { side, usd: 0, n: 0, pw: 0 }); const v = Math.abs(p.szi) * P; x.usd += v; x.n++; x.pw += p.lq * v; });
    const top = side => Object.values(bins).filter(x => x.side === side).sort((a, z) => z.usd - a.usd)[0];
    const f = x => x ? { p: x.pw / x.usd, usd: x.usd, n: x.n, d: x.pw / x.usd / P - 1 } : null;
    return { P, long: f(top("L")), short: f(top("S")) };
  }
  // size-weighted average price of the close orders (take profit or stop), per side, for a group
  function closeAvg(g) {
    const P = mark > 0 ? mark : (Q[FUND] && Q[FUND].c) || NaN, r = { long: { sz: 0, pv: 0, n: 0, w: new Set(), tp: 0, sl: 0 }, short: { sz: 0, pv: 0, n: 0, w: new Set(), tp: 0, sl: 0 } };
    Object.values(W).filter(w => w.g === g && w.pos && w.pos.szi).forEach(w => {
      const side = w.pos.szi > 0 ? "long" : "short", L = ((ORD[w.a] || {}).list || []).filter(o => /close/.test(ordRole(w, o)));
      L.forEach(o => { const x = r[side]; x.sz += o.sz; x.pv += o.sz * o.px; x.n++; x.w.add(w.a); const good = side === "long" ? o.px > P : o.px < P; good ? x.tp += o.sz * o.px : x.sl += o.sz * o.px; });
    });
    const f = x => x.sz ? { px: x.pv / x.sz, usd: x.pv, n: x.n, wallets: x.w.size, tp: x.tp, sl: x.sl, d: isFinite(P) ? x.pv / x.sz / P - 1 : NaN } : null;
    return { long: f(r.long), short: f(r.short) };
  }
  window.wwMoves = () => MV.slice();
  window.wwPositions = () => Object.values(W).filter(w => w.pos && w.pos.szi).map(w => ({ a: w.a, g: w.g, szi: w.pos.szi, ep: w.pos.ep, u: w.pos.u }));
  window.wwList = () => LIST.map(x => ({ a: x[0], g: x[1], pnl: x[2], coh: x[5] }));
  window.wwHlLimited = () => Date.now() - limited < 60000;
  window.wwCloseAvg = closeAvg;
  window.wwPain = pain;
  window.wwOrders = ordAgg;

  async function poll() {
    if (busy && Date.now() - busy < 55000) return; busy = tryAt = Date.now();
    try {
      const m = await hl({ type: "metaAndAssetCtxs", dex: DEX });
      const i = (m[0].universe || []).findIndex(u => u.name === COIN); if (i >= 0) mark = +m[1][i].markPx;
      let ok = 0; const list = Object.keys(W);
      for (let k = 0; k < list.length; k += 5) {         // 5 at a time: all 30 in a few seconds
        await Promise.all(list.slice(k, k + 5).map(async a => {
          try {
            const cs = await hl({ type: "clearinghouseState", user: a, dex: DEX });
            const p = (cs.assetPositions || []).map(x => x.position).find(x => x.coin === COIN);
            W[a].pos = p ? { szi: +p.szi, ep: +p.entryPx, lev: p.leverage ? +p.leverage.value : null, lq: p.liquidationPx ? +p.liquidationPx : null, u: +p.unrealizedPnl || 0 } : { szi: 0 };
            const H = HOLDS[a] = HOLDS[a] || {}; H.xyz = { u: (cs.assetPositions || []).reduce((s, x) => s + (+x.position.unrealizedPnl || 0), 0), acct: +((cs.marginSummary || {}).accountValue) || 0, n: (cs.assetPositions || []).length };
            ok++;
          } catch (e) { }
        }));
      }
      if (!ok) throw new Error("no answer from Hyperliquid");
      err = ""; lastAt = Date.now(); detect();
      render();
      await pollFills(); moveAlerts(mark); await pollOrders(); gradeAll();
    } catch (e) { err = e.message || "error"; }
    save(); busy = 0; render();
  }

  // ---------- worst wallets: change against the size at the last event ----------
  function detect() {
    const P = mark > 0 ? mark : (Q[FUND] && Q[FUND].c) || NaN, now = Date.now();
    for (const w of Object.values(W)) {
      if (!w.pos) continue;
      const p = w.pos;
      if (p.szi && p.lq && isFinite(P) && Math.abs(p.szi) * P >= 500000) {
        const d = Math.abs(P / p.lq - 1);
        if (d <= 0.03) try { alert1(`wwlq:${w.a}:${new Date().toISOString().slice(0, 10)}`, 6 * 3600000, `⚠️ ${usd(Math.abs(p.szi) * P)} ${p.szi > 0 ? "long" : "short"} (${w.g === "B" ? "top" : "worst"} #${w.rank}) is ${(d * 100).toFixed(1)}% from liquidation at ${fmtPx(p.lq)} · forced ${p.szi > 0 ? "selling" : "buying"} can speed up the move`, FUND, true); } catch (e) { }
      }
      if (w.g !== "W") continue;
      const o = anchor[w.a], s1 = p.szi;
      if (o == null) { anchor[w.a] = s1; continue; }
      const s0 = o; if (!isFinite(P)) continue;
      const d$ = Math.abs(s1 - s0) * P, side = x => x > 0 ? "long" : "short";
      let txt = null, kind = null;
      if (s0 === 0 && s1 !== 0 && Math.abs(s1) * P >= MIN_EV) { kind = "open"; txt = `opened a ${usd(Math.abs(s1) * P)} ${side(s1)} @ ${fmtPx(p.ep)}`; }
      else if (s0 !== 0 && s1 === 0 && Math.abs(s0) * P >= MIN_EV) { kind = "close"; txt = `closed a ${usd(Math.abs(s0) * P)} ${side(s0)}`; }
      else if (s0 !== 0 && s1 !== 0 && Math.sign(s0) !== Math.sign(s1)) { kind = "flip"; txt = `flipped ${side(s0)} → ${side(s1)} (${usd(Math.abs(s1) * P)})`; }
      else if (s0 !== 0 && Math.abs(s1) > Math.abs(s0) && d$ >= (STAR[w.a] ? 10000 : MIN_EV)) { kind = "add"; txt = `added ${usd(d$)} to the ${side(s1)} (now ${usd(Math.abs(s1) * P)})`; }
      else if (s0 !== 0 && s1 !== 0 && Math.abs(s1) < Math.abs(s0) && d$ >= (STAR[w.a] ? 10000 : MIN_EV)) { kind = "cut"; txt = `cut ${usd(d$)} of the ${side(s1)} (now ${usd(Math.abs(s1) * P)})`; }
      else if (s0 === 0 && s1 === 0) continue;
      if (txt) {
        anchor[w.a] = s1;
        EV.unshift({ t: now, a: w.a, g: w.g, k: kind, txt, px: P }); EV = EV.slice(0, 40);
        try { alert1(`ww:${w.a}:${kind}:${Math.round(s1)}`, 600000, `${STAR[w.a] ? "★ Starred · " : ""}🐋 Worst #${w.rank} SOXL trader (${usd(w.pnl)} on SOXL) ${txt} · $SOXL perp ${fmtPx(P)} (a losing wallet: often a fade signal)`, FUND, false); } catch (e) { }
      }
    }
  }

  // ---------- summary (also used by the headline and the decision read) ----------
  function summary() {
    const P = mark > 0 ? mark : (Q[FUND] && Q[FUND].c) || NaN, grp = g => Object.values(W).filter(w => w.g === g && w.pos);
    const agg = L => { const o = { n: L.length, longs: 0, shorts: 0, L: 0, S: 0 }; L.forEach(w => { const v = w.pos.szi * P; if (w.pos.szi > 0) { o.longs++; o.L += v; } else if (w.pos.szi < 0) { o.shorts++; o.S -= v; } }); o.net = o.L - o.S; return o; };
    const b = agg(grp("B")), w = agg(grp("W"));
    const liqs = Object.values(W).filter(x => x.pos && x.pos.szi && x.pos.lq).map(x => ({ p: x.pos.lq, usd: Math.abs(x.pos.szi) * P, side: x.pos.szi > 0 ? "long" : "short", w: x }));
    const nearL = liqs.filter(x => x.side === "long" && x.p < P && x.usd >= 250000).sort((a, z) => z.p - a.p)[0] || null;
    const nearS = liqs.filter(x => x.side === "short" && x.p > P && x.usd >= 250000).sort((a, z) => a.p - z.p)[0] || null;
    return { P, b, w, nearL, nearS, ok: !!lastAt };
  }
  window.wwSummary = summary;
  window.wwFlag = function () {
    const s = summary(); if (!s.ok || !isFinite(s.P)) return null;
    const bias = (s.b.L + s.b.S) ? s.b.net / (s.b.L + s.b.S) : 0;
    if (Math.abs(bias) < 0.4 || s.b.L + s.b.S < 500000) return null;
    return `Top SOXL traders on Hyperliquid are net ${bias > 0 ? "long" : "short"} ${usd(Math.abs(s.b.net))} (${s.b.shorts} short, ${s.b.longs} long)` + (s.w.n && Math.sign(s.w.net) === -Math.sign(s.b.net) && Math.abs(s.w.net) > 250000 ? `; the worst wallets lean the other way` : "");
  };
  const topMoves = n => MV.filter(m => W[m.a] && W[m.a].g === "B" && m.usd >= MIN_MOVE).slice(0, n);
  window.wwHeadline = function () {
    const m = topMoves(1)[0]; if (!m || Date.now() - m.t1 > 45 * 60000) return null;
    return `Whale: top #${W[m.a].rank} SOXL trader ${plain(moveTxt(m, mark))}`;
  };
  window.wwTopMoves = topMoves;

  // ---------- trader profiles ----------
  let openRow = null;
  const tags = (a, n) => { const p = PROF[a]; if (!p || !p.tags) return ""; return p.tags.slice(0, n || 9).map(t => `<span class="wwtag ${t[1] || ""}">${esc(t[0])}</span>`).join(""); };
  function profHtml(w) {
    const p = PROF[w.a]; if (!p) return `<div class="sub">No profile yet for this wallet.</div>`;
    const S = p.st || {}, f = (k, v) => `<span class="t">${k}</span><b>${v}</b>`;
    const li = (L, c) => (L || []).map(x => `<li class="${c}">${esc(x)}</li>`).join("");
    return `<div class="wwpc"><h5><span><b class="${w.g === "B" ? "up" : "down"}">${w.g === "B" ? "Top" : "Worst"} #${w.rank}</b> <a href="https://hyperdash.com/address/${w.a}" target="_blank" rel="noopener">${short(w.a)}</a></span><span class="sub">${esc(p.span || "")}</span></h5>
      <div>${tags(w.a)}</div>
      <div class="kv">${f("Round trips", S.trips ?? "--")}${f("Win rate", S.wr ?? "--")}${f("Avg win", S.avgW ?? "--")}${f("Avg loss", S.avgL ?? "--")}${f("Profit factor", S.pf ?? "--")}${f("Hold (median)", S.hold ?? "--")}${f("Size (median)", S.size ?? "--")}${f("Longs / shorts", S.ls ?? "--")}${f("Long P&L", S.lp ?? "--")}${f("Short P&L", S.sp ?? "--")}${f("Last 30 days", S.r30 ?? "--")}${f("Maker share", S.mk ?? "--")}</div>
      ${p.works && p.works.length ? `<b>What works</b><ul>${li(p.works, "w")}</ul>` : ""}${p.fails && p.fails.length ? `<b>What does not work</b><ul>${li(p.fails, "x")}</ul>` : ""}${p.tend && p.tend.length ? `<b>Tendencies</b><ul>${li(p.tend, "")}</ul>` : ""}
      ${p.use ? `<div style="margin-top:6px"><b>How to use this wallet:</b> ${esc(p.use)}</div>` : ""}</div>`;
  }
  window.wwProfile = a => PROF[a] || null;

  // ---------- live ranking and stars ----------
  const RKBY = [["smart", "Smart score"], ["live", "Live score"], ["grade", "Trade grade"], ["grit", "Grit"], ["study", "Study profit"], ["upnl", "Open P&L now"], ["size", "Position size"], ["win", "Win rate"]];
  // ---------- trade grade: keeps gains, avoids round trips, holds through drawdowns, open P&L across all holdings (grade.js) ----------
  const HOLDS = {}, GR = {}; let grT = 0, grBusy = false, GB = null;
  const mult = w => GR[w.a] ? GR[w.a].mult : 1;
  function smartScore(w) { const s = liveScore(w), m = mult(w); return w.g === "B" ? (s >= 0 ? s * m : s / m) : (s <= 0 ? s * (2 - m) : s / (2 - m)); }
  async function gradeAll() {
    if (grBusy || !window.Grade || Date.now() - grT < 10 * 60000) return; grBusy = true;
    try {
      const k = await hl({ type: "candleSnapshot", req: { coin: COIN, interval: "1h", startTime: Date.now() - 200 * 864e5, endTime: Date.now() } });
      if (Array.isArray(k) && k.length) GB = k.map(b => [b.t, +b.h, +b.l, +b.c]);
      let L = null; try { const r = await fetch("https://raw.githubusercontent.com/stevenwsharp-ctrl/Hyperdash-Cohort-Tracker/data/whalelog.json?t=" + Math.floor(Date.now() / 3e5)); if (r.ok) L = await r.json(); } catch (e) { }
      const F = window.inFills ? inFills() : {};
      for (const a of Object.keys(W)) {
        // main (crypto) account: open P&L across all holdings, every 10 minutes
        try { const cs = await hl({ type: "clearinghouseState", user: a }); const H = HOLDS[a] = HOLDS[a] || {}; H.main = { u: (cs.assetPositions || []).reduce((s, x) => s + (+x.position.unrealizedPnl || 0), 0), acct: +((cs.marginSummary || {}).accountValue) || 0, n: (cs.assetPositions || []).length }; } catch (e) { }
        const wi = L && L.wallets ? L.wallets.findIndex(x => x[0] === a) : -1;
        const M = wi >= 0 ? L.moves.filter(m => m[1] === wi).map(m => ({ t: m[0], entry: !!m[2], side: m[3], px: m[4], usd: m[5] })) : [];
        const last = M.length ? M[M.length - 1].t : 0;
        ((F[a] && F[a].f) || []).filter(x => x.coin === COIN && x.time > last).sort((x, y) => x.time - y.time).forEach(x => { const d = x.dir || "", e = /Open|>/.test(d), sd = /Long > Short/.test(d) ? -1 : /Short > Long/.test(d) ? 1 : /Long/.test(d) ? 1 : -1; M.push({ t: x.time, entry: e, side: sd, px: +x.px, usd: +x.sz * +x.px }); });
        const H = HOLDS[a] || {}, up = (H.main ? H.main.u : 0) + (H.xyz ? H.xyz.u : 0), ac = (H.main ? H.main.acct : 0) + (H.xyz ? H.xyz.acct : 0);
        const TR = Grade.trips(M, GB);
        GR[a] = Grade.grade(TR, { bars: GB, px: mark, upnl: H.main || H.xyz ? up : null, acct: ac });
        GR[a].grit = Grade.grit(M, GB, TR);
        GR[a].mult = 1 + 0.5 * (0.55 * GR[a].Q + 0.45 * (GR[a].grit.n >= 5 ? GR[a].grit.G : 0));   // ×0.5 to ×1.5
        GR[a].hold = { u: up, acct: ac, n: (H.main ? H.main.n : 0) + (H.xyz ? H.xyz.n : 0) };
        await new Promise(r => setTimeout(r, 250));
      }
      grT = Date.now(); window.wwGrades = () => GR;
    } catch (e) { console.warn("grade", e); }
    grBusy = false; render();
  }
  function liveScore(w) { const u = w.pos && w.pos.szi ? (w.pos.u || 0) : 0; return w.pnl + (RZ[w.a] || 0) + u; }
  function keyOf(w, by) { const P = mark > 0 ? mark : NaN, p = w.pos || {};
    return by === "smart" ? smartScore(w) : by === "grade" ? (GR[w.a] ? GR[w.a].Q : 0) * (w.g === "B" ? 1 : -1) : by === "grit" ? (GR[w.a] && GR[w.a].grit ? GR[w.a].grit.score : 50) * (w.g === "B" ? 1 : -1) :
      by === "study" ? w.pnl : by === "upnl" ? (p.szi ? p.u || 0 : 0) : by === "size" ? (p.szi ? Math.abs(p.szi) * (P || p.ep || 0) : 0) : by === "win" ? w.wr : liveScore(w); }
  function ranked(g, by) {
    const L = Object.values(W).filter(w => w.g === g); const k = w => keyOf(w, by);
    // best: highest first; worst: the biggest loser first (lowest score), except for size and win rate
    const desc = g === "B" || by === "size" || by === "win";   // grade on the worst list: the weakest habits first (key is -Q)
    L.sort((a, z) => desc ? k(z) - k(a) : k(a) - k(z)); return L;
  }
  function liveRanks() { const out = {}; ["B", "W"].forEach(g => ranked(g, "smart").forEach((w, i) => out[w.a] = i + 1)); return out; }
  function dayKey() { return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }); }
  function snapRanks() { if (!lastAt) return; const d = dayKey(); if (RK.d !== d) { RK = { d, prev: RK.cur && Object.keys(RK.cur).length ? RK.cur : liveRanks(), cur: liveRanks() }; } else RK.cur = liveRanks(); }
  const moveHtml = (a, now) => { const pv = RK.prev && RK.prev[a]; if (!pv) return '<span class="sub">new</span>'; const d = pv - now;
    return d > 0 ? `<span class="up" title="Was #${pv} at the start of the day">▲${d}</span> <span class="sub">#${pv}</span>` : d < 0 ? `<span class="down" title="Was #${pv} at the start of the day">▼${-d}</span> <span class="sub">#${pv}</span>` : `<span class="sub" title="Same as at the start of the day">= #${pv}</span>`; };
  window.wwStarred = () => Object.keys(STAR).filter(a => STAR[a]);

  // ---------- render ----------
  const pill = s => s > 0 ? `<span class="wwp l">long</span>` : s < 0 ? `<span class="wwp s">short</span>` : `<span class="wwp f">flat</span>`;
  function ageHtml() {
    const ago = lastAt ? Math.round((Date.now() - lastAt) / 1000) : null;
    return err && (!lastAt || ago > 90) ? `<span class="wwage bad">${esc(err)} · retrying every minute</span>` : ago == null ? "loading…" :
      `<span class="wwage ${ago > 90 ? "bad" : "ok"}"><span class="livedot"></span>updated ${ago < 90 ? ago + "s" : Math.round(ago / 60) + " min"} ago · next in ${Math.max(0, 60 - (ago % 60))}s</span>`;
  }
  function renderTop() {
    const el = $("wwTop"); if (!el) return;
    const s = summary(), M = topMoves(3), wait = Object.values(W).filter(w => w.g === "B" && !CUR[w.a]).length;
    el.innerHTML = `<div class="hd"><div class="label">🐋 Last 3 moves · top 20 SOXL traders</div><span class="sub">${ageHtml()}</span></div>` +
      (M.length ? M.map(m => { const w = W[m.a]; return `<div class="wwm ${Date.now() - m.t1 < 10 * 60000 ? "new" : ""} ${STAR[m.a] ? "st" : ""}"><span class="rk" title="${esc(w.coh)} · ${w.tr} SOXL trades · ${w.wr}% win">${STAR[m.a] ? "★ " : ""}Top #${w.rank}</span>
        <div class="tx">${moveTxt(m, s.P)}<div class="sub">${tags(m.a, 2)} <a href="https://hyperdash.com/address/${m.a}" target="_blank" rel="noopener">${short(m.a)}</a> · ${usd(w.pnl)} SOXL profit · ${clock(m.t1)} ET</div></div><span class="ag">${agoT(m.t1)}</span></div>`; }).join("")
        : `<div class="sub">${wait ? `Reading the trade history of the top wallets (${NB - wait} of ${NB} done)…` : "No SOXL trades of $10K or more by the top 20 in the last 3 days."}</div>`) +
      (s.ok ? `<div class="sub">Top 20 now: <b class="${s.b.net > 0 ? "up" : s.b.net < 0 ? "down" : ""}">${s.b.net > 0 ? "net long" : s.b.net < 0 ? "net short" : "flat"} ${usd(Math.abs(s.b.net))}</b> · Worst ${NW}: <b class="${s.w.net > 0 ? "up" : s.w.net < 0 ? "down" : ""}">${s.w.net > 0 ? "net long" : s.w.net < 0 ? "net short" : "flat"} ${usd(Math.abs(s.w.net))}</b></div>` : "") +
      (() => { const S = Object.values(W).filter(w => STAR[w.a]); if (!S.length) return ""; const P = mark;
        return `<div class="sub">★ Starred: ${S.map(w => { const p = w.pos || {}; return `<b class="${w.g === "B" ? "up" : "down"}">${w.g === "B" ? "Top" : "Worst"} #${w.rank}</b> ${p.szi ? `${p.szi > 0 ? "long" : "short"} ${usd(Math.abs(p.szi) * (P || p.ep))} <span class="${p.u >= 0 ? "up" : "down"}">${usd(p.u || 0)}</span>` : "flat"}`; }).join(" · ")}</div>`; })() +
      (() => { const c = closeAvg("B"), t = (x, side) => x ? `${side === "short" ? "Shorts cover" : "Longs sell"} at <b>${fmtPx(x.px)}</b> avg <span class="sub">(${fmtPct(x.d, 1)}, size-weighted, ${usd(x.usd)} in ${x.n} order${x.n > 1 ? "s" : ""} from ${x.wallets} wallet${x.wallets > 1 ? "s" : ""}${x.tp && x.sl ? ` · ${usd(x.tp)} take-profit, ${usd(x.sl)} stop` : x.sl ? " · stops" : " · take-profit"})</span>` : "";
        const a = [t(c.short, "short"), t(c.long, "long")].filter(Boolean); return a.length ? `<div class="sub">Top 20 close orders: ${a.join(" · ")}</div>` : ""; })() +
      (() => { const b = ordAgg("B"), w = ordAgg("W"); return b.n + w.n ? `<div class="sub">Resting orders · Top: buy ${usd(b.buy)} / sell ${usd(b.sell)} (${usd(b.add)} to add, ${usd(b.close)} to close) · Worst: buy ${usd(w.buy)} / sell ${usd(w.sell)} · <a href="#whaleCard" data-wwgo="O">see orders</a></div>` : ""; })();
  }
  function render() {
    renderTop();
    const s = summary(), P = s.P;
    $("wwSub").innerHTML = ageHtml() + (isFinite(P) ? ` · perp mark ${fmtPx(P)}` : "");
    const tile = (k, v, sub, c) => `<div class="st"><div class="k">${k}</div><div class="v ${c || ""}">${v}</div><div class="s">${sub || ""}</div></div>`;
    const lean = o => !(o.L + o.S) ? "flat" : o.net > 0 ? "net long" : "net short";
    const m0 = topMoves(1)[0];
    $("wwTiles").innerHTML = !s.ok ? "" :
      tile(`Top ${NB} traders · net`, `${lean(s.b)} ${usd(Math.abs(s.b.net))}`, `${s.b.shorts} short ${usd(s.b.S)} · ${s.b.longs} long ${usd(s.b.L)}`, s.b.net > 0 ? "up" : s.b.net < 0 ? "down" : "") +
      tile(`Worst ${NW} traders · net`, `${lean(s.w)} ${usd(Math.abs(s.w.net))}`, `${s.w.shorts} short ${usd(s.w.S)} · ${s.w.longs} long ${usd(s.w.L)}`, s.w.net > 0 ? "up" : s.w.net < 0 ? "down" : "") +
      tile("Smart vs losing money", Math.sign(s.b.net) && Math.sign(s.b.net) === -Math.sign(s.w.net) ? "Opposite sides" : "Same side", Math.sign(s.b.net) === -Math.sign(s.w.net) ? "the setup the tracker looks for" : "no clear disagreement", Math.sign(s.b.net) === -Math.sign(s.w.net) ? "wwhot" : "") +
      tile("Big long liquidation below", s.nearL ? fmtPx(s.nearL.p) : "--", s.nearL ? `${usd(s.nearL.usd)} · ${fmtPct(s.nearL.p / P - 1, 1)}` : "none ≥ $250K", "down") +
      tile("Big short liquidation above", s.nearS ? fmtPx(s.nearS.p) : "--", s.nearS ? `${usd(s.nearS.usd)} · ${fmtPct(s.nearS.p / P - 1, 1)}` : "none ≥ $250K", "up") +
      tile("Last top-trader move", m0 ? `Top #${W[m0.a].rank}` : "--", m0 ? `${plain(verb(m0))} ${usd(m0.usd)} · ${agoT(m0.t1)}` : "waiting for a trade");
    $("wwTabs").innerHTML = [["B", `Top ${NB}`], ["W", `Worst ${NW}`], ["E", `Moves & order changes (${MV.filter(m => m.usd >= MIN_MOVE).length + EV.length})`], ["O", `Open orders (${Object.values(ORD).reduce((a, o) => a + o.list.length, 0)})`], ["P", "Trader profiles"]].map(([k, l]) => `<button data-wwtab="${k}" class="${tab === k ? "on" : ""}">${l}</button>`).join("");
    if (tab === "P") {
      const L = Object.values(W).sort((a, z) => (a.g === z.g ? a.rank - z.rank : a.g === "B" ? -1 : 1));
      $("wwBody").innerHTML = `<div class="wwpf">${L.map(profHtml).join("")}</div><div class="wwnote">Profiles come from each wallet's SOXL trades on Hyperliquid (round trips from flat to flat, fees included). "Dip buyer" / "momentum" compare each entry with SOXL's move in the 4 hours before it. Small samples are marked; treat them with care.</div>`;
      return;
    }
    if (tab === "O") {
      const rows = Object.values(W).filter(w => ((ORD[w.a] || {}).list || []).length).sort((a, z) => (a.g === z.g ? a.rank - z.rank : a.g === "B" ? -1 : 1));
      const seen = Object.keys(ORD).length;
      $("wwBody").innerHTML = (rows.length ? `<div class="tw"><table class="tbl"><tr><th class="l">Wallet</th><th class="l">Now</th><th class="l">Order</th><th>Price</th><th>vs mark</th><th>Shares</th><th>Value</th><th class="l">What it does</th></tr>` +
        rows.map(w => ((ORD[w.a].list).slice().sort((x, y) => y.px - x.px)).map((o, i) => { const v = o.sz * (o.px || P), r = ordRole(w, o);
          return `<tr><td class="l">${i ? "" : `<b class="${w.g === "B" ? "up" : "down"}">${w.g === "B" ? "Top" : "Worst"} #${w.rank}</b> <a href="https://hyperdash.com/address/${w.a}" target="_blank" rel="noopener">${short(w.a)}</a>`}</td><td class="l">${i ? "" : (w.pos ? pill(w.pos.szi) + (w.pos.szi ? " " + usd(Math.abs(w.pos.szi) * P) : "") : "")}</td>
            <td class="l"><b class="${o.side > 0 ? "up" : "down"}">${o.side > 0 ? "Buy" : "Sell"}</b> ${o.trig ? `<span class="wwhot">${esc(o.type || "trigger")}</span>` : esc(o.type || "limit")}${o.ro ? ' <span class="sub">reduce-only</span>' : ""}</td><td>${fmtPx(o.px)}</td><td>${isFinite(P) && o.px ? fmtPct(o.px / P - 1, 1) : "--"}</td><td>${sh(o.sz)}</td><td>${usd(v)}</td><td class="l ${/close/.test(r) ? "" : "wwhot"}">${r}</td></tr>`; }).join("")).join("") + `</table></div>` : `<div class="sub">${seen ? "No open SOXL orders from the tracked wallets right now." : "Reading open orders…"}</div>`) +
        `<div class="wwnote">Open orders come from Hyperliquid for all ${NB + NW} wallets (about half of them each minute). "Close" orders (reduce-only, or opposite to the position and not larger) take profit or cut risk; "add" and "open" orders grow or start a position. Stop and take-profit triggers show in amber.</div>`;
      return;
    }
    if (tab === "E") {
      const L = [...MV.filter(m => m.usd >= MIN_MOVE && W[m.a]).map(m => ({ t: m.t1, a: m.a, g: "B", h: moveTxt(m, P) })), ...EV.map(e => ({ t: e.t, a: e.a, g: e.g, h: esc(e.txt) + ` <span class="sub">at ${fmtPx(e.px)}</span>` }))].sort((x, y) => y.t - x.t).slice(0, 30);
      $("wwBody").innerHTML = L.length ? `<div class="wwev">${L.map(e => `<span class="t">${clock(e.t)}</span><span><b class="${e.g === "B" ? "up" : "down"}">${e.g === "B" ? "Top" : "Worst"} #${W[e.a] ? W[e.a].rank : "?"}</b> <a href="https://hyperdash.com/address/${e.a}" target="_blank" rel="noopener">${short(e.a)}</a> ${e.h}</span>`).join("")}</div>` : `<div class="sub">No moves yet.</div>`;
      return;
    }
    snapRanks();
    let L = ranked(tab, rkBy); if (onlyStar) L = L.filter(w => STAR[w.a]);
    const lr = liveRanks();
    $("wwBody").innerHTML = `<div class="row" style="gap:6px;margin:0 0 8px;flex-wrap:wrap"><span class="sub">Rank by</span>${RKBY.map(([k, l]) => `<button class="chipb ${rkBy === k ? "on" : ""}" data-wwrk="${k}">${l}</button>`).join("")}<span class="tasep"></span><button class="chipb ${onlyStar ? "on" : ""}" data-wwstaronly="1">★ Starred only (${L.filter ? Object.values(W).filter(w => w.g === tab && STAR[w.a]).length : 0})</button>
      <span class="sub">Live score = study profit + realized since the study + open P&L. Smart score = live score × skill weight (×0.5 to ×1.5) from the trade grade and grit. Grade (A–F): keeps gains, avoids round trips, holds through drawdowns that turn positive, open profit across all holdings. Grit (0–100): steady and disciplined, patient when patience pays and quick when speed pays; impulse (revenge, chasing, quick flips, panic sales) lowers it unless it paid. Hover a grade or grit score for the details. Arrows: change vs the start of the day (ET).</span></div>` +
      (L.length ? "" : `<div class="sub">No starred wallets in this list. Select ☆ in a row to star a wallet.</div>`) +
      `<div class="tw"><table class="tbl"><tr><th></th><th>#</th><th class="l">Move</th><th>Study</th><th>Live score</th><th>Grade</th><th title="Grit 0–100: discipline vs impulse">Grit</th><th>Smart score</th><th title="Open P&L across all positions in all markets (crypto and stocks)">All holdings</th><th class="l">Wallet</th><th>SOXL profit</th><th>Trades</th><th>Win</th><th class="l">Style</th><th class="l">Now</th><th>Size</th><th>Entry</th><th>Lev</th><th>Liq</th><th>To liq</th><th>uPnL</th><th class="l">Orders</th><th class="l">Last move</th></tr>` +
      L.map(w => { const p = w.pos || {}, v = p.szi ? Math.abs(p.szi) * P : 0, dl = p.lq && P ? p.lq / P - 1 : NaN;
        const m = w.g === "B" ? MV.find(x => x.a === w.a) : null, e = w.g === "W" ? EV.find(x => x.a === w.a && Date.now() - x.t < 24 * 3600000) : null;
        const last = m ? `${plain(verb(m))} ${usd(m.usd)} <span class="sub">${agoT(m.t1)}</span>` : e ? `${esc(e.txt)} <span class="sub">${agoT(e.t)}</span>` : '<span class="sub">--</span>';
        const rkNow = L.indexOf(w) + 1, live = lr[w.a];
        return `<tr class="wwr ${STAR[w.a] ? "wwst" : ""}" data-wwrow="${w.a}" title="Select to see this trader's profile"><td><span class="wwstar ${STAR[w.a] ? "on" : ""}" data-wwstar="${w.a}" title="${STAR[w.a] ? "Starred: you get an alert for every move" : "Star: get an alert for every move of this wallet"}">${STAR[w.a] ? "★" : "☆"}</span></td><td><b>${onlyStar ? live : rkNow}</b></td><td class="l">${moveHtml(w.a, live)}</td><td class="sub">${w.g === "B" ? "Top" : "Worst"} #${w.rank}</td><td class="${liveScore(w) > 0 ? "up" : "down"}">${usd(liveScore(w))}</td><td>${GR[w.a] ? Grade.badge(GR[w.a]) || '<span class="sub">n/a</span>' : '<span class="sub">…</span>'}</td><td>${GR[w.a] && GR[w.a].grit ? Grade.gritBadge(GR[w.a].grit) : '<span class="sub">…</span>'}</td><td class="${smartScore(w) > 0 ? "up" : "down"}">${usd(smartScore(w))}</td><td class="${GR[w.a] && GR[w.a].hold.u > 0 ? "up" : GR[w.a] && GR[w.a].hold.u < 0 ? "down" : ""}" title="${GR[w.a] ? GR[w.a].hold.n + " open positions, account " + usd(GR[w.a].hold.acct) : ""}">${GR[w.a] && GR[w.a].hold.n ? usd(GR[w.a].hold.u) : GR[w.a] ? "--" : "…"}</td><td class="l"><a href="https://hyperdash.com/address/${w.a}" target="_blank" rel="noopener" title="${w.a} · ${esc(w.coh)}">${short(w.a)}</a></td><td class="${w.pnl > 0 ? "up" : "down"}">${usd(w.pnl)}</td><td>${w.tr.toLocaleString()}</td><td>${w.wr}%</td><td class="l">${tags(w.a, 2)}</td><td class="l">${w.pos ? pill(p.szi) : '<span class="sub">…</span>'}</td><td>${v ? usd(v) : "--"}</td><td>${p.szi ? fmtPx(p.ep) : "--"}</td><td>${p.lev ? p.lev + "×" : "--"}</td><td>${p.lq ? fmtPx(p.lq) : "--"}</td><td class="${isFinite(dl) && Math.abs(dl) < 0.05 ? "wwhot" : ""}">${isFinite(dl) ? fmtPct(dl, 1) : "--"}</td><td class="${p.u > 0 ? "up" : p.u < 0 ? "down" : ""}">${p.szi ? usd(p.u) : "--"}</td><td class="l wwch">${(() => { const L = (ORD[w.a] || {}).list || []; if (!L.length) return ORD[w.a] ? '<span class="sub">none</span>' : '<span class="sub">…</span>'; const b = L.filter(x => x.side > 0).reduce((a, x) => a + x.sz * (x.px || P), 0), sl = L.filter(x => x.side < 0).reduce((a, x) => a + x.sz * (x.px || P), 0); const C = L.filter(o => /close/.test(ordRole(w, o))), cs = C.reduce((t, o) => t + o.sz, 0); return `${L.length} · <span class="up">buy ${usd(b)}</span> / <span class="down">sell ${usd(sl)}</span>${cs ? ` · close avg <b>${fmtPx(C.reduce((t, o) => t + o.sz * o.px, 0) / cs)}</b>` : ""}`; })()}</td><td class="l wwch">${last}</td></tr>` + (openRow === w.a ? `<tr><td colspan="19" class="wwdet">${profHtml(w)}</td></tr>` : ""); }).join("") + `</table></div>`;
  }
  card.addEventListener("click", e => { const b = e.target.closest("[data-wwtab]"); if (b) { tab = b.dataset.wwtab; render(); return; }
    const sb = e.target.closest("[data-wwstar]"); if (sb) { e.stopPropagation(); const a = sb.dataset.wwstar; STAR[a] = !STAR[a]; if (!STAR[a]) delete STAR[a]; save(); render(); return; }
    const rb = e.target.closest("[data-wwrk]"); if (rb) { rkBy = rb.dataset.wwrk; lsSet("soxx_ww_rkby2", rkBy); render(); return; }
    if (e.target.closest("[data-wwstaronly]")) { onlyStar = !onlyStar; render(); return; }
    const r = e.target.closest("[data-wwrow]"); if (r && !e.target.closest("a")) { openRow = openRow === r.dataset.wwrow ? null : r.dataset.wwrow; render(); } });
  document.addEventListener("click", e => { const g = e.target.closest("[data-wwgo]"); if (g) { e.preventDefault(); tab = g.dataset.wwgo; render(); card.scrollIntoView({ behavior: "smooth", block: "start" }); } });

  render(); poll();
  // every minute, visible or not. A watchdog also runs a poll if one was missed (for example after the computer sleeps).
  setInterval(poll, 60000);
  setInterval(() => { try { if (Date.now() - lastAt > 75000 && Date.now() - tryAt > 60000) poll(); render(); } catch (e) { } }, 5000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - lastAt > 60000) poll(); });
})();
