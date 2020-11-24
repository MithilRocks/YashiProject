import "reflect-metadata";
import { createConnection, getConnection } from "typeorm";
import { Cgn } from "./entity/zz__yashi_cgn";
import { CgnData } from "./entity/zz__yashi_cgn_data";
import { Order } from "./entity/zz__yashi_order";
import { OrderData } from "./entity/zz__yashi_order_data";
import { Creative } from "./entity/zz__yashi_creative";
import { CreativeData } from "./entity/zz__yashi_creative_data";
import { connect } from "net";
import { count } from "console";

const ftp = require("ftp");
const csv = require('csv-parser');

createConnection().then(async connection => {

    getFtpFileList().then(listResponse => {
        return importListExcelInDB(listResponse['files'], listResponse['ftpClient'], connection)
    }).then(async (excelResponse) => {
        console.log("Final promise response", excelResponse);
    }).catch(error => {
        console.log("Process exit with error: ",error)
    }).finally(() => process.exit(0));

}).catch(error => console.log(error));


function getFtpFileList() {
    return new Promise((resolve, reject) => {
        let ftpClient = new ftp();

        ftpClient.on('ready', function () {
            ftpClient.list('/', function (err, files) {
                if (err)
                    reject(err)
                
                let listResponse = {
                    "files":files,
                    "ftpClient": ftpClient
                }
                resolve(listResponse)
            })
        }).connect({
            host: "ftp.clickfuel.com",
            user: "ftp_integration_test",
            port: 21,
            password: "6k0Sb#EXT6jw"
        });
    }).catch(error => console.log(error));
}



function importListExcelInDB(files, ftpClient, connection) {

    const advertiser_ids = []
    ftpClient.get('Yashi_Advertisers.csv', function (err, stream) {
        if (err) throw (err);

        stream.once('close', function () { console.log("Yashi_Advertisers.csv closed") });
        stream.pipe(csv()).on('data', async (row: any) => {
            advertiser_ids.push(row['Advertiser ID']);
        }).on('end', () => {
            console.log('Yashi_Advertisers.csv file successfully processed ');
        });
    });

    let promiseList = files.map((file) => {
        if (file.name != 'Yashi_Advertisers.csv') {
            return new Promise((resolve, reject) => {
                ftpClient.get(file.name, async function (err, stream) {
                    if (err) reject(err)

                    stream.pipe(csv()).on('data', async (row: any) => {

                        if (advertiser_ids.indexOf(row['Advertiser ID']) > -1) {

                            var check_date = new Date(row['Date'])
                            if ((check_date.getMonth() + 1) == 5) {
                                var date = + check_date
                                date = date / 1000

                                connection
                                    .createQueryBuilder()
                                    .insert()
                                    .into(Cgn)
                                    .values([
                                        { yashi_advertiser_id: parseInt(row['Advertiser ID']), yashi_campaign_id: parseInt(row['Campaign ID']), advertiser_name: row['Advertiser Name'], name: row['Campaign Name'] }
                                    ])
                                    .execute()
                                    .catch(error => {
                                        if (error.errno != 1062) {
                                            // skip duplicate entry error
                                            console.log(error)
                                        }
                                    });


                                let campaign = connection
                                    .createQueryBuilder()
                                    .select("cgn")
                                    .from(Cgn, "cgn")
                                    .where("cgn.yashi_campaign_id = :id", { id: parseInt(row['Campaign ID']) })
                                    .getOne();

                                connection
                                    .createQueryBuilder()
                                    .insert()
                                    .into(CgnData)
                                    .values([
                                        {
                                            log_date: date,
                                            impression_count: row['Impressions'],
                                            click_count: row['Clicks'],
                                            "25viewed_count": row['25% Viewed'],
                                            "50viewed_count": row['50% Viewed'],
                                            "75viewed_count": row['75% Viewed'],
                                            "100viewed_count": row['100% Viewed'],
                                            campaign_id: campaign
                                        }
                                    ])
                                    .execute()
                                    .catch(error => {
                                        if (error.errno != 1062) {
                                            // skip duplicate entry error
                                            console.log(error);
                                        }else{
                                            connection.manager.increment(CgnData,{log_date:date,campaign_id:campaign},"impression_count",row['Impressions']);
                                            connection.manager.increment(CgnData,{log_date:date,campaign_id:campaign},"click_count",row['Clicks']);
                                            connection.manager.increment(CgnData,{log_date:date,campaign_id:campaign},"25viewed_count",row['25% Viewed']);
                                            connection.manager.increment(CgnData,{log_date:date,campaign_id:campaign},"50viewed_count",row['50% Viewed']);
                                            connection.manager.increment(CgnData,{log_date:date,campaign_id:campaign},"75viewed_count",row['75% Viewed']);
                                            connection.manager.increment(CgnData,{log_date:date,campaign_id:campaign},"100viewed_count",row['100% Viewed']);
                                        }
                                    });

                                connection
                                    .createQueryBuilder()
                                    .insert()
                                    .into(Order)
                                    .values([
                                        { yashi_order_id: parseInt(row['Order ID']), name: row['Order Name'], campaign_id: campaign }
                                    ])
                                    .execute()
                                    .catch(error => {
                                        if (error.errno != 1062) {
                                            // skip duplicate entry error
                                            console.log(error)
                                        }
                                    });

                                let order = connection
                                    .createQueryBuilder()
                                    .select("order")
                                    .from(Order, "order")
                                    .where("order.yashi_order_id = :id", { id: parseInt(row['Order ID']) })
                                    .getOne();

                                connection
                                    .createQueryBuilder()
                                    .insert()
                                    .into(OrderData)
                                    .values([
                                        {
                                            log_date: date,
                                            impression_count: row['Impressions'],
                                            click_count: row['Clicks'],
                                            "25viewed_count": row['25% Viewed'],
                                            "50viewed_count": row['50% Viewed'],
                                            "75viewed_count": row['75% Viewed'],
                                            "100viewed_count": row['100% Viewed'],
                                            order_id: order
                                        }
                                    ])
                                    .execute()
                                    .catch(error => {
                                        if (error.errno != 1062) {
                                            // skip duplicate entry error
                                            console.log(error)
                                        }else{
                                            connection.manager.increment(OrderData,{log_date:date,order_id:order},"impression_count",row['Impressions']);
                                            connection.manager.increment(OrderData,{log_date:date,order_id:order},"click_count",row['Clicks']);
                                            connection.manager.increment(OrderData,{log_date:date,order_id:order},"25viewed_count",row['25% Viewed']);
                                            connection.manager.increment(OrderData,{log_date:date,order_id:order},"50viewed_count",row['50% Viewed']);
                                            connection.manager.increment(OrderData,{log_date:date,order_id:order},"75viewed_count",row['75% Viewed']);
                                            connection.manager.increment(OrderData,{log_date:date,order_id:order},"100viewed_count",row['100% Viewed']);
                                        }
                                    });

                                connection
                                    .createQueryBuilder()
                                    .insert()
                                    .into(Creative)
                                    .values([
                                        { yashi_creative_id: parseInt(row['Creative ID']), name: row['Creative Name'], preview_url: row['Creative Preview URL'], order_id: order }
                                    ])
                                    .execute()
                                    .catch(error => {
                                        if (error.errno != 1062) {
                                            // skip duplicate entry error
                                            console.log(error)
                                        }
                                    });

                                let creative = connection
                                    .createQueryBuilder()
                                    .select("creative")
                                    .from(Creative, "creative")
                                    .where("creative.yashi_creative_id = :id", { id: parseInt(row['Creative ID']) })
                                    .getOne();

                                connection
                                    .createQueryBuilder()
                                    .insert()
                                    .into(CreativeData)
                                    .values([
                                        {
                                            log_date: date,
                                            impression_count: row['Impressions'],
                                            click_count: row['Clicks'],
                                            "25viewed_count": row['25% Viewed'],
                                            "50viewed_count": row['50% Viewed'],
                                            "75viewed_count": row['75% Viewed'],
                                            "100viewed_count": row['100% Viewed'],
                                            creative_id: creative
                                        }
                                    ])
                                    .execute()
                                    .catch(error => {
                                        if (error.errno != 1062) {
                                            // skip duplicate entry error
                                            console.log(error)
                                        }else{
                                            connection.manager.increment(CreativeData,{log_date:date,creative_id:creative},"impression_count",row['Impressions']);
                                            connection.manager.increment(CreativeData,{log_date:date,creative_id:creative},"click_count",row['Clicks']);
                                            connection.manager.increment(CreativeData,{log_date:date,creative_id:creative},"25viewed_count",row['25% Viewed']);
                                            connection.manager.increment(CreativeData,{log_date:date,creative_id:creative},"50viewed_count",row['50% Viewed']);
                                            connection.manager.increment(CreativeData,{log_date:date,creative_id:creative},"75viewed_count",row['75% Viewed']);
                                            connection.manager.increment(CreativeData,{log_date:date,creative_id:creative},"100viewed_count",row['100% Viewed']);
                                        }
                                    });
                            }

                        }
                    }).on('end', () => {
                        console.log(file.name, ' file successfully processed')
                        resolve(file.name + ' file successfully processed ')
                    });
                    stream.once('close',() => { console.log(file.name, " Closed") });
                })
            }).catch(error => console.log(error));
        }
    })
    return Promise.all(promiseList);
}