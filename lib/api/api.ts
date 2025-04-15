// import type { VerifyResponse, PaymentResponse } from "./types"
// import { decodeJWT, logDecodedJWT } from "@/lib/utils"

// // Обновлённый интерфейс для ответа API verify
// interface VerifyApiResponse {
//   success: boolean;
//   status: boolean;
//   token: string;
//   message?: string;
// }

// // Расширенный интерфейс для ответа авторизации, соответствующий скриншоту
// interface AuthVerifyResponse {
//   status: boolean;
//   success: boolean;
//   token: string;
// }

// // Обновлённая функция verifyWallet с использованием axios
// export async function verifyWallet(signature: string, wallet: string): Promise<VerifyResponse> {
//   console.log("Верификация кошелька:", wallet, "с подписью:", signature)

//   try {
//     // Специальная обработка для мобильной подписи
//     if (signature === 'mobile_signature') {
//       console.log('Обнаружена мобильная подпись, используем тестовые данные');
//       return {
//         token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3NDQyOTcxNTMsImV4cCI6MTc0NDM4MzcyMywiaWF0IjoxNzQ0Mjk3MzIzLCJpZCI6MywibGlua2VkV2FsbGV0IjoiMnl6RUQzS2FXTDY1WUJxMlVTd0dIV2JkUE5QM2JxNlRRN1JBaUhic2JaQ2ciLCJzdWJFeHBBdCI6MCwidG9wdXBXYWxsZXQiOiIzekU4cUE4eFN1Nk5QbzR5V0trN3dWYXdWc3Nlb3hZS3VvTld1VlZLc1lxbiJ9.HeH-csxMUSyqV_6b_2HW5hfH1UAxFYTuTQ4_0z9E2Yw",
//         payload: {
//           id: 3,
//           linkedWallet: wallet,
//           topupWallet: "3zE8qA8xSu6NPo4yWKk7wVawVsseoxYKuoNWuVVKsYqn",
//           subExpAt: 0,
//           createdAt: 1744297153,
//           exp: 1744383723,
//           iat: 1744297323,
//         },
//       };
//     }

//     // Для разработки: переключатель между реальным API и моком
//     const useMockAPI = false; // Установите в true для использования мока
    
//     let data: VerifyApiResponse;
    
//     if (useMockAPI) {
//       // Симуляция API вызова
//       await new Promise((resolve) => setTimeout(resolve, 1000));
      
//       // Мок-ответ, имитирующий формат с скриншота
//       data = {
//         success: true,
//         status: true,
//         token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3NDQyOTcxNTMsImV4cCI6MTc0NDM4MzcyMywiaWF0IjoxNzQ0Mjk3MzIzLCJpZCI6MywibGlua2VkV2FsbGV0IjoiMnl6RUQzS2FXTDY1WUJxMlVTd0dIV2JkUE5QM2JxNlRRN1JBaUhic2JaQ2ciLCJzdWJFeHBBdCI6MCwidG9wdXBXYWxsZXQiOiIzekU4cUE4eFN1Nk5QbzR5V0trN3dWYXdWc3Nlb3hZS3VvTld1VlZLc1lxbiJ9.HeH-csxMUSyqV_6b_2HW5hfH1UAxFYTuTQ4_0z9E2Yw",
//       };
//     } else {
//       // Реальная реализация запроса к API с использованием fetch
//       try {
//         // Подготавливаем данные для запроса
//         const dataPost = {
//           wallet: wallet,
//           signature: signature,
//           timestamp: Date.now()
//         };
        
//         // Выполняем POST запрос с использованием fetch
//         console.log('Отправка запроса:', dataPost);
        
//         const response = await fetch('http://45.91.200.214/api/verify', {
//           method: 'POST',
//           headers: {
//             'Content-Type': 'application/json'
//           },
//           body: JSON.stringify(dataPost)
//         });
        
//         // Проверяем статус ответа
//         console.log('Получен ответ с статусом:', response.status);
        
//         if (!response.ok) {
//           throw new Error(`Ошибка HTTP: ${response.status}`);
//         }
        
//         // Парсим ответ от API
//         const apiResponse = await response.json();
//         console.log('Данные ответа:', apiResponse);
        
//         // Проверяем структуру ответа согласно скриншоту
//         if ('token' in apiResponse) {
//           // Ответ в стандартном формате
//           const authResponse = apiResponse as AuthVerifyResponse;
          
//           // Преобразуем в стандартный формат
//           data = {
//             success: authResponse.success,
//             status: authResponse.status,
//             token: authResponse.token || '',
//           };
          
//           console.log('Получен ответ от API с токеном');
//         } else {
//           // Если формат ответа отличается от ожидаемого
//           console.warn('Получен ответ в нестандартном формате:', apiResponse);
//           data = apiResponse as VerifyApiResponse;
//         }
//       } catch (apiError) {
//         // Обрабатываем ошибки fetch
//         if (apiError instanceof Error) {
//           console.error('Ошибка Fetch:', apiError.message);
          
//           // Если ошибка CORS, логируем специальное сообщение
//           if (apiError.message.includes('CORS')) {
//             console.error('Возникла ошибка CORS. Возможно сервер не настроен для приема запросов с вашего домена.');
//           }
//         } else {
//           console.error('Неизвестная ошибка при запросе:', apiError);
//         }
        
//         throw apiError;
//       }
//     }
    
//     // Проверяем наличие токена
//     if (!data.token) {
//       console.error('API вернул пустой токен');
//       throw new Error('Получен пустой токен аутентификации');
//     }
    
//     // Обработка случая, когда "status": true
//     if (data.status === true) {
//       // Используем функцию для декодирования и логирования JWT
//       const decodedPayload = logDecodedJWT(data.token);
      
//       return {
//         token: data.token,
//         payload: decodedPayload,
//       };
//     }
    
//     // Если статус не true, логируем предупреждение и возвращаем мок-данные для тестирования
//     console.warn('API вернул status: false, используем тестовые данные');
    
//     return {
//       token:
//         "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyXzEyMyIsImNvbm5lY3RlZFdhbGxldCI6IndhbGxldF8xMjMiLCJ0b3B1cFdhbGxldCI6InRvcHVwX3dhbGxldF8xMjMiLCJzdWJzY3JpcHRpb25FeHBpcmVBdCI6bnVsbCwianRUb2tlbiI6ImFjY2Vzc190b2tlbl8xMjMifQ.8yUBiUs9cqUEEtX9vYlVnuHgJZGZlR3d-OsLhAJqQlA",
//       payload: {
//         id: 1,
//         linkedWallet: wallet,
//         topupWallet: "ADgHfNqhY61Pcy3nHmsRDpczMkJ5DnTnZozKcGsM6wZh",
//         subExpAt: 123,
//         createdAt: 123,
//         exp: 123,
//         iat: 123,
//       },
//     };
//   } catch (error) {
//     console.error("Ошибка при верификации кошелька:", error);
    
//     // В случае ошибки возвращаем null в payload
//     return {
//       token: "",
//       payload: null,
//     };
//   }
// }

// export async function checkPayment(): Promise<PaymentResponse> {
//   // In a real app, this would be a fetch call to your API
//   console.log("Checking payment status")

//   // Simulate API call
//   await new Promise((resolve) => setTimeout(resolve, 1500))

//   // Mock response - randomly return true or false
//   return {
//     accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3NDQyOTcxNTMsImV4cCI6MTc0NDM4MzcyMywiaWF0IjoxNzQ0Mjk3MzIzLCJpZCI6MywibGlua2VkV2FsbGV0IjoiMnl6RUQzS2FXTDY1WUJxMlVTd0dIV2JkUE5QM2JxNlRRN1JBaUhic2JaQ2ciLCJzdWJFeHBBdCI6MCwidG9wdXBXYWxsZXQiOiIzekU4cUE4eFN1Nk5QbzR5V0trN3dWYXdWc3Nlb3hZS3VvTld1VlZLc1lxbiJ9.HeH-csxMUSyqV_6b_2HW5hfH1UAxFYTuTQ4_0z9E2Yw",
//     expireAt: "2025-05-10 22:02:50.761638 +0300 +03",
//     hasSubscription: true,
//     success: true
//   }
// }
